from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration via environment variables (see docker-compose.yml)."""

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    # ClickHouse (the OTel Collector writes otel_traces here)
    clickhouse_host: str = "clickhouse"
    clickhouse_port: int = 8123
    clickhouse_user: str = "default"
    clickhouse_password: str = ""
    clickhouse_database: str = "otel"
    traces_table: str = "otel_traces"

    # How often the WebSocket pushes a fresh snapshot, and how often
    # the alert engine evaluates rules (seconds).
    push_interval_seconds: int = 3
    alert_interval_seconds: int = 15

    # Default rolling window for "current" metrics (seconds).
    default_window_seconds: int = 60

    # Alert rule storage.
    alerts_file: str = "config/alerts.json"

    # Notification channels (optional — left blank => logged only).
    slack_webhook_url: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "apm-dashboard@example.com"
    smtp_to: str = ""

    # CORS origin for the frontend.
    frontend_origin: str = "http://localhost:3000"


settings = Settings()
