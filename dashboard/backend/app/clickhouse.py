"""Thin ClickHouse access layer.

The OpenTelemetry Collector's ClickHouse exporter creates and writes the
`otel_traces` table. This module only reads from it. All query helpers degrade
gracefully (return empty results) when the table does not exist yet — e.g. on a
fresh stack before any traffic has flowed.
"""
import logging

import clickhouse_connect
from clickhouse_connect.driver.exceptions import ClickHouseError

from .config import settings

log = logging.getLogger("dashboard.clickhouse")

_client = None


def get_client():
    global _client
    if _client is None:
        _client = clickhouse_connect.get_client(
            host=settings.clickhouse_host,
            port=settings.clickhouse_port,
            username=settings.clickhouse_user,
            password=settings.clickhouse_password,
            database=settings.clickhouse_database,
            connect_timeout=5,
            send_receive_timeout=30,
        )
    return _client


def query(sql: str, parameters: dict | None = None) -> list[dict]:
    """Run a query and return a list of row dicts. Returns [] on missing table."""
    try:
        result = get_client().query(sql, parameters=parameters or {})
        cols = result.column_names
        return [dict(zip(cols, row)) for row in result.result_rows]
    except ClickHouseError as exc:
        # 60 = UNKNOWN_TABLE, 81 = UNKNOWN_DATABASE — expected before first export.
        if any(code in str(exc) for code in ("UNKNOWN_TABLE", "UNKNOWN_DATABASE", "60", "81")):
            log.warning("ClickHouse table not ready yet: %s", exc)
            return []
        raise


def table_exists() -> bool:
    try:
        rows = query(
            "SELECT 1 FROM system.tables WHERE database = {db:String} AND name = {tbl:String}",
            {"db": settings.clickhouse_database, "tbl": settings.traces_table},
        )
        return bool(rows)
    except Exception:  # noqa: BLE001 - startup probe must never crash the app
        return False
