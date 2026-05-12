import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { useCrimes } from "@/hooks/use-crimes";
import { dbscan, isolationForest, kmeans } from "@/lib/ml";
import { useHydrateStore } from "@/lib/store";
import { Brain, Target, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
const CrimeMap = lazy(() => import("@/components/map/CrimeMap").then(m => ({ default: m.CrimeMap })));

export const Route = createFileRoute("/_authenticated/analysis")({ component: Analysis });

function Analysis() {
  useHydrateStore();
  const crimes = useCrimes();
  const points = useMemo(() => (crimes.data ?? []).filter(r => r.latitude != null && r.longitude != null)
    .map(r => ({ lat: r.latitude!, lng: r.longitude! })), [crimes.data]);

  const [algo, setAlgo] = useState<"kmeans" | "dbscan" | "isolation">("kmeans");
  const [k, setK] = useState(6);
  const [eps, setEps] = useState(0.6);
  const [minPts, setMinPts] = useState(8);

  const result = useMemo(() => {
    if (points.length < 20) return null;
    if (algo === "kmeans") {
      const r = kmeans(points, k);
      const max = Math.max(...r.sizes, 1);
      return {
        clusters: r.centers.map((c, i) => ({ ...c, size: r.sizes[i], risk: r.sizes[i] / max })),
        anomalies: [] as { lat: number; lng: number }[],
        summary: `${r.sizes.length} clusters · largest hotspot has ${Math.max(...r.sizes)} incidents`,
      };
    }
    if (algo === "dbscan") {
      // Sample down for performance on big sets
      const sample = points.length > 1500 ? points.filter((_, i) => i % Math.ceil(points.length / 1500) === 0) : points;
      const r = dbscan(sample, eps, minPts);
      const groups = new Map<number, { lat: number; lng: number; n: number }>();
      sample.forEach((p, i) => {
        if (r.labels[i] < 0) return;
        const g = groups.get(r.labels[i]) ?? { lat: 0, lng: 0, n: 0 };
        g.lat += p.lat; g.lng += p.lng; g.n++;
        groups.set(r.labels[i], g);
      });
      const max = Math.max(1, ...[...groups.values()].map(g => g.n));
      const clusters = [...groups.values()].map(g => ({ lat: g.lat / g.n, lng: g.lng / g.n, size: g.n, risk: g.n / max }));
      const noise = sample.filter((_, i) => r.labels[i] === -1).slice(0, 100);
      return { clusters, anomalies: noise, summary: `${r.clusters} dense regions · ${noise.length} noise points` };
    }
    const scores = isolationForest(points, 50, 256);
    const sorted = [...scores].sort((a, b) => b - a);
    const cutoff = sorted[Math.floor(sorted.length * 0.05)] ?? 0.7;
    const an = points.filter((_, i) => scores[i] >= cutoff);
    return { clusters: [], anomalies: an, summary: `${an.length} anomalies (top 5% by isolation score)` };
  }, [points, algo, k, eps, minPts]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">ML Pipeline</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">AI <span className="gradient-text">Analysis</span></h1>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { id: "kmeans", icon: Target, title: "K-Means", desc: "Centroid hotspots" },
          { id: "dbscan", icon: Brain, title: "DBSCAN", desc: "Dense regions + noise" },
          { id: "isolation", icon: AlertTriangle, title: "Isolation Forest", desc: "Anomaly detection" },
        ].map(a => (
          <motion.button key={a.id} whileHover={{ y: -2 }} onClick={() => setAlgo(a.id as any)}
            className={`glass rounded-xl p-4 text-left transition ${algo === a.id ? "border-primary/60" : ""}`}
            style={algo === a.id ? { boxShadow: "var(--shadow-neon)" } : undefined}>
            <a.icon className="h-5 w-5 mb-2" style={{ color: algo === a.id ? "var(--neon-purple)" : "var(--neon-cyan)" }} />
            <div className="font-display font-semibold">{a.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{a.desc}</div>
          </motion.button>
        ))}
      </div>

      <div className="glass rounded-xl p-5 grid sm:grid-cols-3 gap-4">
        {algo === "kmeans" && (
          <Slider label="Clusters (k)" value={k} setValue={setK} min={2} max={15} />
        )}
        {algo === "dbscan" && (<>
          <Slider label="eps (km)" value={eps} setValue={setEps} min={0.1} max={3} step={0.1} />
          <Slider label="min samples" value={minPts} setValue={setMinPts} min={3} max={30} />
        </>)}
        <div className="text-xs text-muted-foreground self-end">{result?.summary ?? "Need at least 20 geo-tagged incidents."}</div>
      </div>

      <Suspense fallback={<div className="h-[60vh] grid place-items-center text-muted-foreground">Loading map…</div>}>
        <CrimeMap points={points} clusters={result?.clusters ?? []} anomalies={result?.anomalies ?? []} height={560} />
      </Suspense>
    </div>
  );
}

function Slider({ label, value, setValue, min, max, step = 1 }:
  { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}: <span className="text-foreground">{value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(parseFloat(e.target.value))}
        className="w-full accent-[oklch(0.7_0.27_305)]" />
    </label>
  );
}
