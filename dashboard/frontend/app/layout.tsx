import type { Metadata } from "next";
import "./globals.css";
import { LiveProvider } from "@/lib/LiveProvider";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Real-Time APM Dashboard",
  description: "Live application performance monitoring over OpenTelemetry data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveProvider>
          <Nav />
          <main className="p-6 max-w-7xl mx-auto">{children}</main>
        </LiveProvider>
      </body>
    </html>
  );
}
