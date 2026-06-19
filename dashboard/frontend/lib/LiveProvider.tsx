"use client";
import { createContext, useContext, ReactNode } from "react";
import { useLiveSnapshot } from "./useLiveSnapshot";
import type { AlertEvent, Overview } from "./types";

interface LiveValue {
  snapshot: Overview | null;
  alerts: AlertEvent[];
  connected: boolean;
}

const LiveContext = createContext<LiveValue>({ snapshot: null, alerts: [], connected: false });

export function LiveProvider({ children }: { children: ReactNode }) {
  const value = useLiveSnapshot();
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => useContext(LiveContext);
