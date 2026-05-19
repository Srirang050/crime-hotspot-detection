import { createFileRoute, Link } from "@tanstack/react-router";
import { useCrimes, useDatasets } from "@/hooks/use-crimes";
import { StatCard } from "@/components/dashboard/StatCard";
import { Activity, AlertTriangle, MapPin, Database, Brain, ArrowRight } from "lucide-react";
import { useMemo, lazy, Suspense, useEffect } from "react";
import { bucketByMonth, bucketByType, bucketByHour, kmeans, isolationForest } from "@/lib/ml";
import { useActiveDatasetId, useHydrateStore, setActiveDatasetId } from "@/lib/store";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid,
} from "recharts";

const CrimeMap = lazy(() => import("@/components/map/CrimeMap").then(m => ({ default: m.CrimeMap })));

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  useHydrateStore();
  const datasets = useDatasets();
  const activeId = useActiveDatasetId();
  const crimes = useCrimes();
  const rows = crimes.data ?? [];

  // Auto-select most recent dataset, or fall back if active one was deleted
  useEffect(() => {
    const list = datasets.data;
    if (!list || list.length === 0) return;
    const exists = activeId && list.some((d) => d.id === activeId);
    if (!exists) setActiveDatasetId(list[0].id);
  }, [datasets.data, activeId]);

  const monthly = useMemo(() => bucketByMonth(rows as any).slice(-18), [rows]);
  const hours = useMemo(() => bucketByHour(rows as any), [rows]);
  const types = useMemo(() => bucketByType(rows as any, 6), [rows]);
  const chartNotice = rows.length > 0 && (monthly.length === 0 || types.length === 0)
    ? "This dataset is missing parsed date or category fields. Re-upload it to apply the improved column matching."
    : null;
  const points = useMemo(() => rows.filter(r => r.latitude != null && r.longitude != null).map(r => ({ lat: r.latitude!, lng: r.longitude! })), [rows]);

  const { clusters, anomalies } = useMemo(() => {
    if (points.length < 30) return { clusters: [], anomalies: [] };
    // Scale K with dataset size so clusters reflect the data, not a constant
    const k = Math.max(3, Math.min(12, Math.round(Math.sqrt(points.length / 200))));
    const { centers, labels, sizes } = kmeans(points, k);
    // risk: cluster density
    const maxSize = Math.max(...sizes, 1);
    const c = centers.map((ct, i) => ({ ...ct, size: sizes[i], risk: sizes[i] / maxSize }));
    const sampleSize = Math.min(points.length, 1500);
    const scoringPoints = points.length > sampleSize
      ? points.filter((_, i) => i % Math.ceil(points.length / sampleSize) === 0)
      : points;
    const scores = isolationForest(scoringPoints, 30, 200);
    const sorted = [...scores].sort((a, b) => b - a);
    const cutoff = sorted[Math.floor(sorted.length * 0.03)] ?? 0.7;
    const flagged = scoringPoints.filter((_, i) => scores[i] >= cutoff);
    const an = flagged.slice(0, 120);
    void labels;
    return { clusters: c, anomalies: an };
  }, [points]);

  const arrests = rows.filter(r => r.arrest).length;
  const arrestRate = rows.length ? Math.round((arrests / rows.length) * 100) : 0;

  if (!datasets.isLoading && (datasets.data?.length ?? 0) === 0) return <Empty />;

  return (
    <div className="space-y-6">
      <Header
        total={rows.length}
        notice={chartNotice}
        datasets={datasets.data ?? []}
        activeId={activeId}
        onChange={(id) => setActiveDatasetId(id)}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={rows.length} icon={Activity} accent="primary" />
        <StatCard label="Hotspot Clusters" value={clusters.length} icon={MapPin} accent="cyan" />
        <StatCard label="Anomalies Detected" value={anomalies.length} icon={AlertTriangle} accent="warn" />
        <StatCard label="Arrest Rate" value={arrestRate} icon={Brain} accent="danger" suffix="%" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-display font-semibold">Crime Trend (Monthly)</div>
              <div className="text-xs text-muted-foreground">Last 18 months</div>
            </div>
          </div>
          <div className="h-64">
            {monthly.length > 0 ? (
              <ResponsiveContainer key={`monthly-${activeId}`}>
                <AreaChart data={monthly}>
                  <defs>
                    <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.7 0.27 305)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="oklch(0.72 0.22 245)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.5 0.1 280 / 0.15)" />
                  <XAxis dataKey="label" stroke="oklch(0.7 0.04 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.04 260)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.04 268)", border: "1px solid oklch(0.5 0.1 280 / 0.4)", borderRadius: 8 }} />
                  <Area dataKey="count" stroke="oklch(0.75 0.22 295)" fill="url(#g1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <ChartEmpty label="No date values found" />}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
          <div className="font-display font-semibold mb-4">Top Categories</div>
          <div className="h-64">
            {types.length > 0 ? (
              <ResponsiveContainer key={`types-${activeId}`}>
                <BarChart data={types} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" stroke="oklch(0.7 0.04 260)" fontSize={11} />
                  <YAxis type="category" dataKey="type" stroke="oklch(0.7 0.04 260)" fontSize={11} width={110} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.04 268)", border: "1px solid oklch(0.5 0.1 280 / 0.4)", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="oklch(0.72 0.22 245)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <ChartEmpty label="No category values found" />}
          </div>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-semibold">Hotspot Heatmap</div>
            <Link to="/map" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Full map <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Suspense fallback={<div className="h-[420px] grid place-items-center text-muted-foreground">Loading map…</div>}>
            <CrimeMap points={points} clusters={clusters} anomalies={anomalies} height={420} />
          </Suspense>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
          <div className="font-display font-semibold mb-4">Hour-of-Day Activity</div>
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={hours}>
                <CartesianGrid stroke="oklch(0.5 0.1 280 / 0.15)" />
                <XAxis dataKey="hour" stroke="oklch(0.7 0.04 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.04 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.04 268)", border: "1px solid oklch(0.5 0.1 280 / 0.4)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="oklch(0.7 0.27 305)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

type DatasetLite = { id: string; name: string; row_count: number };
function Header({ total, notice, datasets, activeId, onChange }: { total: number; notice: string | null; datasets: DatasetLite[]; activeId: string | null; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Command Center</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">Operational <span className="gradient-text">Overview</span></h1>
        <div className="text-sm text-muted-foreground mt-1">{total.toLocaleString()} incidents loaded</div>
        {notice && <div className="text-xs text-warn mt-2 max-w-xl">{notice}</div>}
      </div>
      {datasets.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dataset</label>
          <select
            value={activeId ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="glass rounded-lg px-3 py-2 text-sm bg-transparent border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[220px]"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id} className="bg-background">
                {d.name} ({d.row_count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-full grid place-items-center text-center text-sm text-muted-foreground border border-border/30 rounded-lg bg-secondary/10">
      {label}
    </div>
  );
}

function Empty() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="glass rounded-2xl p-10 max-w-md text-center">
        <Database className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--neon-cyan)" }} />
        <h2 className="font-display text-xl font-bold">No datasets yet</h2>
        <p className="text-sm text-muted-foreground mt-2">Upload a Chicago-format crime CSV or load the sample dataset to begin analysis.</p>
        <Link to="/datasets" className="inline-block mt-5 px-5 py-2.5 rounded-lg font-medium text-primary-foreground glow-primary"
          style={{ background: "var(--gradient-primary)" }}>Go to Datasets</Link>
      </div>
    </div>
  );
}
