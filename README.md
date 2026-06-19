# APM with OpenTelemetry — 3 Java Microservices

A hands-on **Application Performance Monitoring** demo built around **distributed tracing**.
Three Spring Boot services call each other, are auto-instrumented with the
**OpenTelemetry Java agent**, and export traces + metrics to a full observability stack.

```
client ─POST /api/checkout/{sku}─▶ gateway-service ─▶ order-service ─▶ inventory-service
                                        │                  │                  │
                                        └──────── OTLP (traces + metrics) ─────┘
                                                          ▼
                                                  OTel Collector
                                                   ┌────┴────┐
                                              Jaeger      Prometheus ─▶ Grafana
                                             (traces)      (metrics)
```

A single request to the gateway produces **one end-to-end trace spanning all three
services** — the core thing APM gives you.

## The three projects

| Service | Port | Role | Calls |
|---|---|---|---|
| **gateway-service** | 8080 | Public entry point. Starts the trace. | → order-service |
| **order-service** | 8081 | Creates an order, decides confirm/backorder. | → inventory-service |
| **inventory-service** | 8082 | Leaf service. Owns stock levels per SKU. | — |

## Observability stack

| Tool | URL | Purpose |
|---|---|---|
| **Jaeger** | http://localhost:16686 | View distributed traces (select `gateway-service`) |
| **Prometheus** | http://localhost:9090 | Query raw metrics |
| **Grafana** | http://localhost:3000 | Dashboards (anonymous admin, datasource pre-wired) |
| OTel Collector | :4317 / :4318 | Receives OTLP, fans out to Jaeger + Prometheus |

## Quick start (Docker — no Maven needed)

Everything (build + agents + backends) runs in containers:

```bash
docker compose up --build
```

Wait for all services to report healthy, then generate traffic:

```powershell
# Windows
./scripts/load-test.ps1 -Count 50
```
```bash
# macOS / Linux
./scripts/load-test.sh 50
```

Or fire a single request:

```bash
curl -X POST http://localhost:8080/api/checkout/SKU-001
```

Now open **Jaeger** (http://localhost:16686), pick `gateway-service`, and click a trace —
you'll see spans flow gateway → order → inventory with timing for each hop.

Sample SKUs: `SKU-001` (in stock), `SKU-002` (low), `SKU-003` (out of stock),
anything else → `BACKORDERED`.

## Running locally without Docker (optional)

The services are a standard Maven multi-module project. You need Maven 3.9+ and the
OTel agent jar.

```powershell
# Install Maven if needed
winget install Apache.Maven

# Build all three
mvn clean package

# Download the OpenTelemetry Java agent once
curl -L -o opentelemetry-javaagent.jar `
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
```

Start an OTLP backend (e.g. `docker compose up otel-collector jaeger prometheus grafana`),
then launch each service in its own terminal:

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
$env:OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"

java -javaagent:opentelemetry-javaagent.jar -DOTEL_SERVICE_NAME=inventory-service -jar inventory-service/target/inventory-service.jar
java -javaagent:opentelemetry-javaagent.jar -DOTEL_SERVICE_NAME=order-service     -jar order-service/target/order-service.jar
java -javaagent:opentelemetry-javaagent.jar -DOTEL_SERVICE_NAME=gateway-service   -jar gateway-service/target/gateway-service.jar
```

## How the instrumentation works

There is **no tracing code** in the services. The `-javaagent:opentelemetry-javaagent.jar`
flag attaches at JVM start and auto-instruments Spring MVC and `RestTemplate`. It:

1. Creates a server span for each incoming HTTP request.
2. Injects W3C `traceparent` headers on outgoing `RestTemplate` calls.
3. The downstream service reads those headers and continues the same trace.

Configuration is entirely via `OTEL_*` environment variables (see `docker-compose.yml`).

## Project layout

```
.
├── pom.xml                      # parent (multi-module)
├── gateway-service/             # project 1
├── order-service/               # project 2
├── inventory-service/           # project 3
├── Dockerfile                   # one parametrized multi-stage build for all services
├── docker-compose.yml           # apps + OTel Collector + Jaeger + Prometheus + Grafana
├── otel/
│   ├── otel-collector-config.yaml
│   ├── prometheus.yml
│   └── grafana/provisioning/    # auto-wired Prometheus datasource
└── scripts/                     # load generators
```

## License

MIT
