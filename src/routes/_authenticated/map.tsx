import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { useCrimes } from "@/hooks/use-crimes";
import { useHydrateStore } from "@/lib/store";
const CrimeMap = lazy(() => import("@/components/map/CrimeMap").then(m => ({ default: m.CrimeMap })));

export const Route = createFileRoute("/_authenticated/map")({ component: MapPage });

function MapPage() {
  useHydrateStore();
  const crimes = useCrimes();
  const points = useMemo(() => (crimes.data ?? []).filter(r => r.latitude != null && r.longitude != null)
    .map(r => ({ lat: r.latitude!, lng: r.longitude! })), [crimes.data]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Spatial Intelligence</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">Hotspot <span className="gradient-text">Map</span></h1>
        <p className="text-sm text-muted-foreground mt-1">{points.length.toLocaleString()} geo-tagged incidents</p>
      </div>
      <Suspense fallback={<div className="h-[70vh] grid place-items-center text-muted-foreground">Loading map…</div>}>
        <CrimeMap points={points} height={Math.max(560, typeof window !== "undefined" ? window.innerHeight - 220 : 600)} />
      </Suspense>
      <Legend />
    </div>
  );
}
function Legend() {
  return (
    <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
      <div className="font-display text-foreground">Heat Intensity:</div>
      {[
        { c: "#3b82f6", l: "Low" }, { c: "#8b5cf6", l: "Moderate" },
        { c: "#ec4899", l: "High" }, { c: "#f97316", l: "Critical" }, { c: "#ef4444", l: "Extreme" },
      ].map(s => (
        <div key={s.l} className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: s.c }} />{s.l}</div>
      ))}
    </div>
  );
}
