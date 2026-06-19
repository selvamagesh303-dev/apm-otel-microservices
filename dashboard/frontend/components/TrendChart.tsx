"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimePoint } from "@/lib/types";

function fmtTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function LatencyChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="ts" tickFormatter={fmtTime} stroke="#6b7280" fontSize={11} />
        <YAxis stroke="#6b7280" fontSize={11} unit="ms" />
        <Tooltip
          labelFormatter={fmtTime}
          contentStyle={{ background: "#141a24", border: "1px solid #1f2937", borderRadius: 8 }}
        />
        <Area type="monotone" dataKey="p95_ms" name="p95 (ms)" stroke="#60a5fa" fill="#1d4ed833" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RateChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
        <XAxis dataKey="ts" tickFormatter={fmtTime} stroke="#6b7280" fontSize={11} />
        <YAxis stroke="#6b7280" fontSize={11} />
        <Tooltip
          labelFormatter={fmtTime}
          contentStyle={{ background: "#141a24", border: "1px solid #1f2937", borderRadius: 8 }}
        />
        <Line type="monotone" dataKey="request_rate" name="req/s" stroke="#34d399" dot={false} />
        <Line type="monotone" dataKey="error_rate" name="error rate" stroke="#f87171" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
