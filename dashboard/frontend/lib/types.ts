export interface ServiceMetrics {
  service: string;
  spans: number;
  request_rate: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface Overview {
  window_seconds: number;
  totals: { request_rate: number; error_rate: number; p95_ms: number; spans: number };
  services: ServiceMetrics[];
}

export interface TimePoint {
  ts: string;
  request_rate: number;
  error_rate: number;
  p95_ms: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  calls: number;
  p95_ms: number;
  error_rate: number;
}

export interface Dependencies {
  nodes: { id: string }[];
  edges: DependencyEdge[];
}

export interface SlowTrace {
  trace_id: string;
  service: string;
  name: string;
  duration_ms: number;
  status: string;
  ts: string;
}

export interface Span {
  span_id: string;
  parent_span_id: string;
  service: string;
  name: string;
  kind: string;
  duration_ms: number;
  status: string;
  ts: string;
  offset_ms: number;
  attributes: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: "error_rate" | "p95_ms" | "request_rate";
  service: string;
  comparator: ">" | "<";
  threshold: number;
  window_seconds: number;
  channels: string[];
  enabled: boolean;
}

export interface AlertEvent {
  rule_id: string;
  name: string;
  service: string;
  metric: string;
  comparator: string;
  threshold: number;
  value: number;
  state: "firing" | "resolved";
  channels: string[];
}

export interface Anomaly {
  service: string;
  metric: string;
  current: number;
  baseline_mean: number;
  sigma: number;
  worst: { index: number; value: number; z_score: number };
  flagged_points: number;
}
