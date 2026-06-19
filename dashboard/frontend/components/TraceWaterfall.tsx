"use client";
import type { Span } from "@/lib/types";

const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171"];

export function TraceWaterfall({ spans }: { spans: Span[] }) {
  if (!spans.length) return <div className="text-gray-500">No spans for this trace.</div>;
  const total = Math.max(...spans.map((s) => s.offset_ms + s.duration_ms), 1);
  const serviceColor = (svc: string) =>
    COLORS[[...new Set(spans.map((s) => s.service))].indexOf(svc) % COLORS.length];

  return (
    <div className="space-y-1">
      {spans.map((s) => (
        <div key={s.span_id} className="flex items-center gap-2 text-xs">
          <div className="w-56 truncate text-gray-300" title={`${s.service} · ${s.name}`}>
            <span className="text-gray-500">{s.service}</span> {s.name}
          </div>
          <div className="flex-1 relative h-5 bg-ink rounded">
            <div
              className="absolute h-5 rounded flex items-center px-1"
              style={{
                left: `${(s.offset_ms / total) * 100}%`,
                width: `${Math.max((s.duration_ms / total) * 100, 1)}%`,
                background: s.status === "Error" ? "#7f1d1d" : serviceColor(s.service),
              }}
            >
              <span className="text-[10px] text-white/90">{s.duration_ms}ms</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
