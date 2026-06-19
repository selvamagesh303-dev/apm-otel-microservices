"""Lightweight statistical anomaly detection.

For each service we pull a recent latency/rate series and flag the most recent
buckets whose value sits beyond `sigma` standard deviations from the rolling
mean (a z-score test). This is intentionally simple and explainable — not ML —
which is the right default for a demo and easy to reason about.
"""
from statistics import mean, pstdev

from . import metrics


def _zscore_flags(series: list[float], sigma: float) -> list[dict]:
    if len(series) < 5:
        return []
    baseline = series[:-1]
    mu = mean(baseline)
    sd = pstdev(baseline)
    if sd == 0:
        return []
    flags = []
    for i, value in enumerate(series):
        z = (value - mu) / sd
        if abs(z) >= sigma:
            flags.append({"index": i, "value": round(value, 3), "z_score": round(z, 2)})
    return flags


def detect(window: int = 1800, bucket: int = 30, sigma: float = 3.0) -> list[dict]:
    """Scan every service for anomalies in p95 latency and request rate."""
    anomalies: list[dict] = []
    for svc in metrics.list_services(window=window):
        service = svc["service"]
        points = metrics.timeseries(service, window=window, bucket=bucket)
        if len(points) < 5:
            continue
        for metric_key in ("p95_ms", "request_rate", "error_rate"):
            values = [float(p[metric_key]) for p in points]
            flags = _zscore_flags(values, sigma)
            if not flags:
                continue
            worst = max(flags, key=lambda f: abs(f["z_score"]))
            anomalies.append({
                "service": service,
                "metric": metric_key,
                "current": values[-1],
                "baseline_mean": round(mean(values[:-1]), 3),
                "sigma": sigma,
                "worst": worst,
                "flagged_points": len(flags),
            })
    return anomalies
