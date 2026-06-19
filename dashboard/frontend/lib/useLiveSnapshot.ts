"use client";
import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./api";
import type { AlertEvent, Overview } from "./types";

/**
 * Subscribes to the backend WebSocket. Returns the latest live overview
 * snapshot, a rolling list of recent alert events, and connection status.
 * Reconnects automatically with a short backoff.
 */
export function useLiveSnapshot() {
  const [snapshot, setSnapshot] = useState<Overview | null>(null);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") {
          setSnapshot(msg.data as Overview);
        } else if (msg.type === "alert") {
          setAlerts((prev) => [msg.data as AlertEvent, ...prev].slice(0, 20));
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  return { snapshot, alerts, connected };
}
