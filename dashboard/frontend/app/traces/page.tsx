"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TraceWaterfall } from "@/components/TraceWaterfall";
import type { SlowTrace, Span } from "@/lib/types";

export default function TracesPage() {
  const [traces, setTraces] = useState<SlowTrace[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => api.slowTraces(25).then((t) => active && setTraces(t)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const open = async (id: string) => {
    setSelected(id);
    try {
      const detail = await api.trace(id);
      setSpans(detail.spans);
    } catch {
      setSpans([]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Slow Transactions</h2>
        <p className="text-sm text-gray-400">Slowest root traces in the window. Click one to drill into its spans.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr>
              <th className="py-1">Entry</th>
              <th>Service</th>
              <th>Duration</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.trace_id} className="border-t border-edge hover:bg-edge/50">
                <td className="py-1.5">{t.name}</td>
                <td>{t.service}</td>
                <td className={t.duration_ms > 750 ? "text-amber-400" : ""}>{t.duration_ms}ms</td>
                <td className={t.status === "Error" ? "text-red-400" : "text-green-400"}>{t.status}</td>
                <td>
                  <button className="btn" onClick={() => open(t.trace_id)}>Inspect</button>
                </td>
              </tr>
            ))}
            {traces.length === 0 && (
              <tr><td colSpan={5} className="py-3 text-gray-500">No traces yet — run the load generator.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-gray-400">Trace {selected.slice(0, 16)}…</h3>
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </div>
          <TraceWaterfall spans={spans} />
        </div>
      )}
    </div>
  );
}
