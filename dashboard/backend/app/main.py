"""FastAPI app: REST + WebSocket API for the real-time APM dashboard."""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from . import anomaly, metrics
from .alerts import AlertEngine
from .clickhouse import table_exists
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("dashboard")


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self._connections.discard(ws)

    async def broadcast(self, message: dict):
        payload = json.dumps(jsonable_encoder(message), default=str)
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
engine = AlertEngine(broadcast=manager.broadcast)


async def _push_loop():
    """Periodically push a live overview snapshot to all WebSocket clients."""
    while True:
        try:
            snapshot = await asyncio.to_thread(metrics.overview, settings.default_window_seconds)
            await manager.broadcast({"type": "snapshot", "data": snapshot})
        except Exception:  # noqa: BLE001
            log.exception("snapshot push failed")
        await asyncio.sleep(settings.push_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    push_task = asyncio.create_task(_push_loop())
    alert_task = asyncio.create_task(engine.run())
    log.info("dashboard backend ready (clickhouse table present=%s)", table_exists())
    try:
        yield
    finally:
        push_task.cancel()
        alert_task.cancel()


app = FastAPI(title="Real-Time APM Dashboard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "clickhouse_table": table_exists()}


@app.get("/api/overview")
def overview(window: int | None = None):
    return metrics.overview(window)


@app.get("/api/services")
def services(window: int | None = None):
    return metrics.list_services(window)


@app.get("/api/timeseries")
def timeseries(service: str | None = None, window: int = 900, bucket: int = 15):
    return metrics.timeseries(service, window, bucket)


@app.get("/api/dependencies")
def dependencies(window: int | None = None):
    return metrics.dependencies(window)


@app.get("/api/traces/slow")
def slow_traces(window: int | None = None, limit: int = 20):
    return metrics.slow_traces(window, limit)


@app.get("/api/traces/{trace_id}")
def trace_detail(trace_id: str):
    return metrics.trace_detail(trace_id)


@app.get("/api/anomalies")
def anomalies(window: int = 1800, bucket: int = 30, sigma: float = 3.0):
    return anomaly.detect(window, bucket, sigma)


@app.get("/api/alerts")
def list_alerts():
    return engine.list_rules()


@app.post("/api/alerts")
def upsert_alert(rule: dict = Body(...)):
    return engine.upsert_rule(rule)


@app.delete("/api/alerts/{rule_id}")
def delete_alert(rule_id: str):
    return {"deleted": engine.delete_rule(rule_id)}


@app.get("/api/alerts/history")
def alert_history():
    return engine.history()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Send an immediate snapshot so the UI populates without waiting a tick.
        snapshot = await asyncio.to_thread(metrics.overview, settings.default_window_seconds)
        await ws.send_text(json.dumps(jsonable_encoder({"type": "snapshot", "data": snapshot}), default=str))
        while True:
            await ws.receive_text()  # keep the connection open; ignore client messages
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:  # noqa: BLE001
        manager.disconnect(ws)
