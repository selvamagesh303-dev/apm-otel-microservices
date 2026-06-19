"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLive } from "@/lib/LiveProvider";

const links = [
  { href: "/", label: "Overview" },
  { href: "/dependencies", label: "Service Map" },
  { href: "/traces", label: "Traces" },
  { href: "/alerts", label: "Alerts" },
];

export function Nav() {
  const path = usePathname();
  const { connected } = useLive();
  return (
    <nav className="flex items-center gap-1 px-6 py-3 border-b border-edge bg-panel">
      <span className="font-semibold mr-6">📈 APM Dashboard</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            path === l.href ? "bg-edge text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {l.label}
        </Link>
      ))}
      <span className="ml-auto flex items-center gap-2 text-xs text-gray-400">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        {connected ? "live" : "offline"}
      </span>
    </nav>
  );
}
