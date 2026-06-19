"""Derives APM metrics from the OTel `otel_traces` table.

Request rate, error rate and latency percentiles are all computed from server
spans; the service-dependency map and slow-transaction list come from the span
parent/child relationships. ClickHouse does the heavy aggregation (quantiles,
self-joins) — exactly what a column store is good at.
"""
from .clickhouse import query
from .config import settings

TABLE = f"{settings.clickhouse_database}.{settings.traces_table}"


def _w(window: int | None) -> int:
    return int(window or settings.default_window_seconds)


def list_services(window: int | None = None) -> list[dict]:
    w = _w(window)
    return query(
        f"""
        SELECT ServiceName AS service,
               count()                         AS spans,
               round(count() / {w}, 3)         AS request_rate,
               round(countIf(StatusCode = 'Error') / count(), 4) AS error_rate,
               round(quantile(0.50)(Duration) / 1e6, 2) AS p50_ms,
               round(quantile(0.95)(Duration) / 1e6, 2) AS p95_ms,
               round(quantile(0.99)(Duration) / 1e6, 2) AS p99_ms
        FROM {TABLE}
        WHERE SpanKind = 'Server'
          AND Timestamp >= now() - INTERVAL {w} SECOND
        GROUP BY service
        ORDER BY request_rate DESC
        """
    )


def overview(window: int | None = None) -> dict:
    w = _w(window)
    totals = query(
        f"""
        SELECT round(count() / {w}, 3) AS request_rate,
               round(countIf(StatusCode = 'Error') / greatest(count(), 1), 4) AS error_rate,
               if(count() = 0, 0, round(quantile(0.95)(Duration) / 1e6, 2)) AS p95_ms,
               count() AS spans
        FROM {TABLE}
        WHERE SpanKind = 'Server'
          AND Timestamp >= now() - INTERVAL {w} SECOND
        """
    )
    return {
        "window_seconds": w,
        "totals": totals[0] if totals else {"request_rate": 0, "error_rate": 0, "p95_ms": 0, "spans": 0},
        "services": list_services(w),
    }


def timeseries(service: str | None, window: int = 900, bucket: int = 15) -> list[dict]:
    w, b = int(window), max(int(bucket), 1)
    service_filter = ""
    params: dict = {}
    if service and service != "*":
        service_filter = "AND ServiceName = {service:String}"
        params["service"] = service
    return query(
        f"""
        SELECT toStartOfInterval(Timestamp, INTERVAL {b} SECOND) AS ts,
               round(count() / {b}, 3)                           AS request_rate,
               round(countIf(StatusCode = 'Error') / count(), 4) AS error_rate,
               round(quantile(0.95)(Duration) / 1e6, 2)          AS p95_ms
        FROM {TABLE}
        WHERE SpanKind = 'Server' {service_filter}
          AND Timestamp >= now() - INTERVAL {w} SECOND
        GROUP BY ts
        ORDER BY ts
        """,
        params,
    )


def dependencies(window: int | None = None) -> dict:
    w = _w(window)
    edges = query(
        f"""
        SELECT parent.ServiceName AS source,
               child.ServiceName  AS target,
               count()            AS calls,
               round(quantile(0.95)(child.Duration) / 1e6, 2) AS p95_ms,
               round(countIf(child.StatusCode = 'Error') / count(), 4) AS error_rate
        FROM {TABLE} AS child
        INNER JOIN {TABLE} AS parent
          ON child.ParentSpanId = parent.SpanId AND child.TraceId = parent.TraceId
        WHERE child.Timestamp >= now() - INTERVAL {w} SECOND
          AND parent.ServiceName != child.ServiceName
        GROUP BY source, target
        ORDER BY calls DESC
        """
    )
    nodes = sorted({n for e in edges for n in (e["source"], e["target"])})
    return {"nodes": [{"id": n} for n in nodes], "edges": edges}


def slow_traces(window: int | None = None, limit: int = 20) -> list[dict]:
    w = _w(window)
    return query(
        f"""
        SELECT TraceId AS trace_id, ServiceName AS service, SpanName AS name,
               round(Duration / 1e6, 2) AS duration_ms, StatusCode AS status, Timestamp AS ts
        FROM {TABLE}
        WHERE ParentSpanId = '' AND Timestamp >= now() - INTERVAL {w} SECOND
        ORDER BY Duration DESC
        LIMIT {int(limit)}
        """
    )


def trace_detail(trace_id: str) -> dict:
    spans = query(
        f"""
        SELECT SpanId AS span_id, ParentSpanId AS parent_span_id, ServiceName AS service,
               SpanName AS name, SpanKind AS kind, round(Duration / 1e6, 3) AS duration_ms,
               StatusCode AS status, Timestamp AS ts, SpanAttributes AS attributes
        FROM {TABLE}
        WHERE TraceId = {{trace_id:String}}
        ORDER BY Timestamp
        """,
        {"trace_id": trace_id},
    )
    if not spans:
        return {"trace_id": trace_id, "spans": []}
    # Compute offsets relative to the first span for a waterfall view.
    t0 = min(s["ts"] for s in spans)
    for s in spans:
        s["offset_ms"] = round((s["ts"] - t0).total_seconds() * 1000, 3)
    return {"trace_id": trace_id, "spans": spans}
