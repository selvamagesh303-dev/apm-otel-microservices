"use client";
import { useMemo } from "react";
import { ReactFlow, Background, Controls, MarkerType, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Dependencies } from "@/lib/types";

/** Simple layered layout: a node's column = its longest distance from a root. */
function layout(deps: Dependencies): { nodes: Node[]; edges: Edge[] } {
  const incoming = new Map<string, number>();
  deps.nodes.forEach((n) => incoming.set(n.id, 0));
  deps.edges.forEach((e) => incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1));

  // BFS depth from roots (no incoming edges).
  const depth = new Map<string, number>();
  const roots = deps.nodes.filter((n) => (incoming.get(n.id) ?? 0) === 0).map((n) => n.id);
  const queue = [...(roots.length ? roots : deps.nodes.map((n) => n.id))];
  queue.forEach((id) => depth.set(id, 0));
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    deps.edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        if ((depth.get(e.target) ?? -1) < d + 1) {
          depth.set(e.target, d + 1);
          queue.push(e.target);
        }
      });
  }

  const perColumn = new Map<number, number>();
  const nodes: Node[] = deps.nodes.map((n) => {
    const col = depth.get(n.id) ?? 0;
    const row = perColumn.get(col) ?? 0;
    perColumn.set(col, row + 1);
    return {
      id: n.id,
      position: { x: col * 280, y: row * 120 + 40 },
      data: { label: n.id },
      style: {
        background: "#141a24",
        color: "#e5e7eb",
        border: "1px solid #334155",
        borderRadius: 10,
        padding: 10,
        width: 180,
        fontSize: 13,
      },
    };
  });

  const edges: Edge[] = deps.edges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    label: `${e.calls} calls · p95 ${e.p95_ms}ms`,
    animated: e.error_rate > 0,
    style: { stroke: e.error_rate > 0.1 ? "#f87171" : "#475569" },
    labelStyle: { fill: "#9ca3af", fontSize: 11 },
    labelBgStyle: { fill: "#0b0f17" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
  }));

  return { nodes, edges };
}

export function DependencyMap({ deps }: { deps: Dependencies }) {
  const { nodes, edges } = useMemo(() => layout(deps), [deps]);
  return (
    <div className="card" style={{ height: 480 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#1f2937" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
