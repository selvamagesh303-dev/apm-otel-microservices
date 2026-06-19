"use client";
import { useEffect, useMemo, useState } from "react";
import { useLive } from "@/lib/LiveProvider";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { LatencyChart, RateChart } from "@/components/TrendChart";
import type { Anomaly, TimePoint } from "@/lib/types";

export default function OverviewPage() {
  const { snapshot, alerts } = useLive();
  const [selected, setSelected] = useState<string>("");
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const services = snapshot?.services ?? [];

  // Default the chart to the busiest service once data arrives.
  useEffect(() => {
    if (!selected && services.length) setSelected(services[0].service);
  }, [services, selected]);

  // Poll the time-series + anomalies for the selected service.
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const load = async () => {
      try {
        const [ts, an] = await Promise.all([api.timeseries(selected, 900, 15), api.anomalies()]);
        if (active) {
          setSeries(ts);
          setAnomalies(an);
        }
      } catch {
        /* backend warming up */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [selected]);

  const t = snapshot?.totals;
  const errPct = t ? (t.error_rate * 100).toFixed(2) : "0.00";

  const errorTone = useMemo(() => {
    if (!t) return "default" as const;
    if (t.error_rate > 0.1) return "bad" as const;
    if (t.error_rate > 0.02) return "warn" as const;
    return "good" as const;
  }, [t]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Request rate" value={t?.request_rate ?? 0} unit="req/s" />
        <MetricCard label="Error rate" value={`${errPct}%`} tone={errorTone} />
        <MetricCard label="p95 latency" value={t?.p95_ms ?? 0} unit="ms" tone={t && t.p95_ms > 750 ? "warn" : "default"} />
        <MetricCard label="Spans (window)" value={t?.spans ?? 0} />
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((a, i) => (
            <div
              key={i}
              className={`card border-l-4 ${a.state === "firing" ? "border-l-red-500" : "border-l-green-500"}`}
            >
              <span className="font-medium">{a.state === "firing" ? "🔴" : "✅"} {a.name}</span>
              <span className="text-gray-400 text-sm ml-2">
                {a.service}/{a.metric} = {a.value} ({a.comparator} {a.threshold})
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Service:</span>
        <select className="input w-48" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {services.map((s) => (
            <option key={s.service} value={s.service}>{s.service}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">p95 latency</h3>
          <LatencyChart data={series} />
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">Request &amp; error rate</h3>
          <RateChart data={series} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="text-sm text-gray-400 mb-3">Services ({snapshot?.window_seconds ?? 60}s window)</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr>
              <th className="py-1">Service</th>
              <th>req/s</th>
              <th>error %</th>
              <th>p50</th>
              <th>p95</th>
              <th>p99</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.service} className="border-t border-edge">
                <td className="py-1.5 font-medium">{s.service}</td>
                <td>{s.request_rate}</td>
                <td className={s.error_rate > 0.1 ? "text-red-400" : ""}>{(s.error_rate * 100).toFixed(2)}%</td>
                <td>{s.p50_ms}ms</td>
                <td>{s.p95_ms}ms</td>
                <td>{s.p99_ms}ms</td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-gray-500">Waiting for traffic… run the load generator.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {anomalies.length > 0 && (
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-3">⚠️ Anomalies (z-score ≥ {anomalies[0].sigma})</h3>
          <ul className="space-y-1 text-sm">
            {anomalies.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.service}</span> — {a.metric}: current{" "}
                <span className="text-amber-400">{a.current}</span> vs baseline {a.baseline_mean}{" "}
                (z={a.worst.z_score})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
