"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLive } from "@/lib/LiveProvider";
import type { AlertRule } from "@/lib/types";

const BLANK: AlertRule = {
  id: "",
  name: "",
  metric: "p95_ms",
  service: "*",
  comparator: ">",
  threshold: 500,
  window_seconds: 60,
  channels: ["slack"],
  enabled: true,
};

export default function AlertsPage() {
  const { alerts } = useLive();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [draft, setDraft] = useState<AlertRule>(BLANK);

  const refresh = () => api.alerts().then(setRules).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!draft.id || !draft.name) return;
    await api.upsertAlert({ ...draft, threshold: Number(draft.threshold) });
    setDraft(BLANK);
    refresh();
  };

  const remove = async (id: string) => {
    await api.deleteAlert(id);
    refresh();
  };

  const toggle = async (r: AlertRule) => {
    await api.upsertAlert({ ...r, enabled: !r.enabled });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Alerting</h2>
        <p className="text-sm text-gray-400">
          Threshold rules evaluated server-side. Notifications fire to Slack/email on state changes (configure
          webhook/SMTP via env).
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm text-gray-400 mb-3">Rules</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-left">
            <tr><th className="py-1">Name</th><th>Condition</th><th>Channels</th><th>Enabled</th><th></th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-edge">
                <td className="py-1.5">{r.name}</td>
                <td className="text-gray-300">
                  {r.service}/{r.metric} {r.comparator} {r.threshold} <span className="text-gray-500">({r.window_seconds}s)</span>
                </td>
                <td className="text-gray-400">{r.channels.join(", ")}</td>
                <td>
                  <button className="btn" onClick={() => toggle(r)}>{r.enabled ? "✅ on" : "⛔ off"}</button>
                </td>
                <td><button className="btn" onClick={() => remove(r.id)}>Delete</button></td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={5} className="py-3 text-gray-500">No rules.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card grid md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-gray-400">ID</label>
          <input className="input" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="my-rule" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Name</label>
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="My rule" />
        </div>
        <div>
          <label className="text-xs text-gray-400">Service (* = all)</label>
          <input className="input" value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-400">Metric</label>
          <select className="input" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value as AlertRule["metric"] })}>
            <option value="p95_ms">p95_ms</option>
            <option value="error_rate">error_rate</option>
            <option value="request_rate">request_rate</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Comparator</label>
          <select className="input" value={draft.comparator} onChange={(e) => setDraft({ ...draft, comparator: e.target.value as AlertRule["comparator"] })}>
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Threshold</label>
          <input className="input" type="number" value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-3">
          <button className="btn" onClick={save}>Save rule</button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm text-gray-400 mb-3">Recent alert events (live)</h3>
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-sm">No events this session.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {alerts.map((a, i) => (
              <li key={i}>
                {a.state === "firing" ? "🔴" : "✅"} <span className="font-medium">{a.name}</span> — {a.service}/{a.metric} = {a.value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
