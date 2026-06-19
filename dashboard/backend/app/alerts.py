"""Threshold-based alerting engine with Slack / email notifications.

Rules are stored in a JSON file and editable through the API. A background task
evaluates them on a fixed interval; notifications fire only on state changes
(OK -> firing and firing -> resolved) so channels are never spammed.
"""
import asyncio
import json
import logging
import smtplib
from email.mime.text import MIMEText
from pathlib import Path

import httpx

from . import metrics
from .config import settings

log = logging.getLogger("dashboard.alerts")

VALID_METRICS = {"error_rate", "p95_ms", "request_rate"}

DEFAULT_RULES = [
    {
        "id": "high-error-rate",
        "name": "High error rate (gateway)",
        "metric": "error_rate",
        "service": "gateway-service",
        "comparator": ">",
        "threshold": 0.10,
        "window_seconds": 60,
        "channels": ["slack"],
        "enabled": True,
    },
    {
        "id": "slow-p95",
        "name": "Slow p95 latency (any service)",
        "metric": "p95_ms",
        "service": "*",
        "comparator": ">",
        "threshold": 750,
        "window_seconds": 60,
        "channels": ["slack", "email"],
        "enabled": True,
    },
]


class AlertEngine:
    def __init__(self, broadcast=None):
        self._path = Path(settings.alerts_file)
        self._rules = self._load()
        self._firing: dict[str, bool] = {}
        self._history: list[dict] = []
        self._broadcast = broadcast  # async callable(event) to push to WS clients

    # ---- rule storage ----
    def _load(self) -> list[dict]:
        if self._path.exists():
            try:
                return json.loads(self._path.read_text())
            except json.JSONDecodeError:
                log.warning("alerts file invalid; falling back to defaults")
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(DEFAULT_RULES, indent=2))
        return list(DEFAULT_RULES)

    def _save(self) -> None:
        self._path.write_text(json.dumps(self._rules, indent=2))

    def list_rules(self) -> list[dict]:
        return self._rules

    def upsert_rule(self, rule: dict) -> dict:
        if rule.get("metric") not in VALID_METRICS:
            raise ValueError(f"metric must be one of {sorted(VALID_METRICS)}")
        if rule.get("comparator") not in (">", "<"):
            raise ValueError("comparator must be '>' or '<'")
        existing = next((r for r in self._rules if r["id"] == rule["id"]), None)
        if existing:
            existing.update(rule)
        else:
            self._rules.append(rule)
        self._save()
        return rule

    def delete_rule(self, rule_id: str) -> bool:
        before = len(self._rules)
        self._rules = [r for r in self._rules if r["id"] != rule_id]
        self._firing.pop(rule_id, None)
        self._save()
        return len(self._rules) != before

    def history(self) -> list[dict]:
        return self._history[-100:]

    # ---- evaluation ----
    def _current_value(self, rule: dict):
        window = rule.get("window_seconds", 60)
        metric = rule["metric"]
        if rule["service"] == "*":
            return metrics.overview(window)["totals"].get(metric)
        for svc in metrics.list_services(window):
            if svc["service"] == rule["service"]:
                return svc.get(metric)
        return None

    @staticmethod
    def _breached(value, comparator: str, threshold: float) -> bool:
        if value is None:
            return False
        return value > threshold if comparator == ">" else value < threshold

    async def evaluate_once(self) -> list[dict]:
        events: list[dict] = []
        for rule in self._rules:
            if not rule.get("enabled", True):
                continue
            value = await asyncio.to_thread(self._current_value, rule)
            breached = self._breached(value, rule["comparator"], rule["threshold"])
            was_firing = self._firing.get(rule["id"], False)
            if breached and not was_firing:
                self._firing[rule["id"]] = True
                events.append(self._event(rule, value, "firing"))
            elif not breached and was_firing:
                self._firing[rule["id"]] = False
                events.append(self._event(rule, value, "resolved"))
        for event in events:
            self._history.append(event)
            await self._notify(event)
            if self._broadcast:
                await self._broadcast({"type": "alert", "data": event})
        return events

    @staticmethod
    def _event(rule: dict, value, state: str) -> dict:
        return {
            "rule_id": rule["id"],
            "name": rule.get("name", rule["id"]),
            "service": rule["service"],
            "metric": rule["metric"],
            "comparator": rule["comparator"],
            "threshold": rule["threshold"],
            "value": value,
            "state": state,
            "channels": rule.get("channels", []),
        }

    async def run(self) -> None:
        log.info("alert engine started (interval=%ss)", settings.alert_interval_seconds)
        while True:
            try:
                await self.evaluate_once()
            except Exception:  # noqa: BLE001 - keep the loop alive
                log.exception("alert evaluation failed")
            await asyncio.sleep(settings.alert_interval_seconds)

    # ---- notifications ----
    async def _notify(self, event: dict) -> None:
        emoji = "🔴" if event["state"] == "firing" else "✅"
        text = (
            f"{emoji} [{event['state'].upper()}] {event['name']} — "
            f"{event['service']}/{event['metric']} = {event['value']} "
            f"({event['comparator']} {event['threshold']})"
        )
        log.warning("ALERT %s", text)
        if "slack" in event["channels"]:
            await self._send_slack(text)
        if "email" in event["channels"]:
            await asyncio.to_thread(self._send_email, f"[APM] {event['name']}", text)

    async def _send_slack(self, text: str) -> None:
        if not settings.slack_webhook_url:
            log.info("slack webhook not configured; skipping (would send: %s)", text)
            return
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(settings.slack_webhook_url, json={"text": text})
        except Exception:  # noqa: BLE001
            log.exception("slack notification failed")

    def _send_email(self, subject: str, body: str) -> None:
        if not (settings.smtp_host and settings.smtp_to):
            log.info("smtp not configured; skipping email (would send: %s)", subject)
            return
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from
            msg["To"] = settings.smtp_to
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        except Exception:  # noqa: BLE001
            log.exception("email notification failed")
