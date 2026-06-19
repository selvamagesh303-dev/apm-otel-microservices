"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DependencyMap } from "@/components/DependencyMap";
import type { Dependencies } from "@/lib/types";

export default function DependenciesPage() {
  const [deps, setDeps] = useState<Dependencies>({ nodes: [], edges: [] });

  useEffect(() => {
    let active = true;
    const load = () => api.dependencies().then((d) => active && setDeps(d)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Service Dependency Map</h2>
        <p className="text-sm text-gray-400">
          Edges are derived from span parent/child relationships across services. Red = error traffic, animated =
          active errors.
        </p>
      </div>
      {deps.nodes.length ? (
        <DependencyMap deps={deps} />
      ) : (
        <div className="card text-gray-500">No inter-service calls yet — run the load generator to populate the map.</div>
      )}
    </div>
  );
}
