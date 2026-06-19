# APM with OpenTelemetry — Microservices + Real-Time Dashboard

A hands-on **Application Performance Monitoring** portfolio built on **OpenTelemetry**.
Three instrumented Java microservices emit telemetry; a full observability stack collects
it; and a custom **real-time dashboard** (FastAPI + ClickHouse + Next.js) visualizes it.

```
                                          ┌──> Jaeger        (trace explorer)
client ─▶ gateway ─▶ order ─▶ inventory   │
   (Java + OpenTelemetry Java agent)      │
            │  OTLP traces + metrics      │
            └────────▶ OTel Collector ────┼──> Prometheus ──> Grafana
                                          │
                                          └──> ClickHouse ──> FastAPI ──WS/REST──> Next.js dashboard
```

## The two projects

### Project 1 — Instrumented microservices (`microservices/`)
Three Spring Boot services with **zero tracing code** — auto-instrumented by the
OpenTelemetry Java agent. One request produces a single distributed trace across all three.

| Service | Port | Role |
|---|---|---|
| `gateway-service` | 8080 | Public entry point — starts the trace |
| `order-service` | 8081 | Creates orders, calls inventory |
| `inventory-service` | 8082 | Leaf service — owns stock per SKU |

### Project 2 — Real-Time APM Dashboard (`dashboard/`)
A full-stack monitoring UI that reads the OpenTelemetry data from ClickHouse and renders it live.

- **Live metrics** — request rate, error rate, p50/p95/p99 latency, streamed over WebSocket
- **Service dependency map** — built from span parent/child relationships (React Flow)
- **Alerting** — configurable threshold rules with Slack / email notifications on state change
- **Anomaly detection** — z-score test over recent latency/rate/error series
- **Trace drill-down** — slowest transactions with a span waterfall view

**Stack:** Next.js + TypeScript + Tailwind frontend · FastAPI (Python) backend · ClickHouse
time-series store · WebSockets for real-time updates.

## All the UIs

| UI | URL | What |
|---|---|---|
| **APM Dashboard** | http://localhost:3000 | The custom dashboard (project 2) |
| Dashboard API docs | http://localhost:8000/docs | FastAPI OpenAPI explorer |
| Jaeger | http://localhost:16686 | Raw distributed traces |
| Prometheus | http://localhost:9090 | Metric queries |
| Grafana | http://localhost:3001 | Dashboards (anonymous admin) |

## Quick start (one command — Docker only)

Everything builds and runs in containers; no Java/Node/Python needed locally:

```bash
docker compose up --build
```

> Prefer Kubernetes? The full stack also ships as Kustomize manifests — see
> [`k8s/`](k8s/) for `kubectl apply -k k8s/`.

Generate traffic so the dashboards fill up:

```powershell
./scripts/load-test.ps1 -Count 80      # Windows
```
```bash
./scripts/load-test.sh 80               # macOS / Linux
```

Then open the **dashboard at http://localhost:3000**. Try the Service Map, Traces, and
Alerts tabs. Sample SKUs: `SKU-001` (in stock), `SKU-003` (out of stock), anything else
→ `BACKORDERED`. To trip an alert, hammer out-of-stock SKUs to push the error rate up.

### Enabling real alert notifications (optional)
```bash
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX" docker compose up --build
```
Email uses the `SMTP_*` env vars (see `dashboard/backend/app/config.py`). Without either,
alerts are evaluated and shown in the UI/logs but not sent externally.

## How the instrumentation works

There is **no tracing code** in the Java services. The `-javaagent:opentelemetry-javaagent.jar`
flag attaches at JVM start, auto-instruments Spring MVC + `RestTemplate`, creates a server
span per request, and injects W3C `traceparent` headers on outbound calls so downstream
services join the same trace. The OTel Collector fans that data out to Jaeger, Prometheus,
and ClickHouse. The dashboard backend then computes APM metrics from `otel_traces` using
ClickHouse aggregations (`quantile()`, self-joins for the dependency map).

## Repository layout

```
.
├── microservices/            # PROJECT 1
│   ├── pom.xml               #   Maven multi-module parent
│   ├── gateway-service/
│   ├── order-service/
│   ├── inventory-service/
│   └── Dockerfile            #   one parametrized multi-stage build for all 3
├── dashboard/                # PROJECT 2
│   ├── backend/              #   FastAPI + ClickHouse (REST + WebSocket + alerts)
│   └── frontend/             #   Next.js + TypeScript + Tailwind
├── otel/
│   ├── otel-collector-config.yaml   # OTLP -> Jaeger + Prometheus + ClickHouse
│   ├── prometheus.yml
│   └── grafana/provisioning/
├── k8s/                      # Kustomize manifests (kubectl apply -k k8s/)
├── scripts/                  # load generators + image build/push
└── docker-compose.yml        # the whole stack
```

## Running pieces individually (dev)

**Microservices** need Maven (`winget install Apache.Maven`) — see `microservices/` and run
`mvn -f microservices/pom.xml clean package`, then launch each jar with the OTel agent.

**Dashboard backend**: `cd dashboard/backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
(point `CLICKHOUSE_HOST` at a running ClickHouse).

**Dashboard frontend**: `cd dashboard/frontend && npm install && npm run dev`.

## License

MIT
