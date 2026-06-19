import type {
  AlertRule,
  Anomaly,
  Dependencies,
  Overview,
  ServiceMetrics,
  SlowTrace,
  Span,
  TimePoint,
} from "./types";

export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = API.replace(/^http/, "ws") + "/ws";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  overview: (window?: number) => get<Overview>(`/api/overview${window ? `?window=${window}` : ""}`),
  services: () => get<ServiceMetrics[]>("/api/services"),
  timeseries: (service: string, window = 900, bucket = 15) =>
    get<TimePoint[]>(`/api/timeseries?service=${encodeURIComponent(service)}&window=${window}&bucket=${bucket}`),
  dependencies: () => get<Dependencies>("/api/dependencies"),
  slowTraces: (limit = 20) => get<SlowTrace[]>(`/api/traces/slow?limit=${limit}`),
  trace: (id: string) => get<{ trace_id: string; spans: Span[] }>(`/api/traces/${id}`),
  anomalies: () => get<Anomaly[]>("/api/anomalies"),
  alerts: () => get<AlertRule[]>("/api/alerts"),
  upsertAlert: async (rule: AlertRule) => {
    const res = await fetch(`${API}/api/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    if (!res.ok) throw new Error(`upsert -> ${res.status}`);
    return res.json();
  },
  deleteAlert: async (id: string) => {
    const res = await fetch(`${API}/api/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`delete -> ${res.status}`);
    return res.json();
  },
};
