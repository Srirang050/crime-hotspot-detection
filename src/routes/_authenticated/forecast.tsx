import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useCrimes } from "@/hooks/use-crimes";
import { bucketByMonth, forecastMonths } from "@/lib/ml";
import { useHydrateStore } from "@/lib/store";
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { TrendingUp, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/forecast")({ component: Forecast });

function Forecast() {
  useHydrateStore();
  const crimes = useCrimes();
  const series = useMemo(() => bucketByMonth(crimes.data ?? []), [crimes.data]);
  const forecast = useMemo(() => forecastMonths(series, 6), [series]);

  const merged = useMemo(() => {
    const past = series.map(s => ({ label: s.label, actual: s.count, forecast: null as number | null }));
    const fut = forecast.map(f => ({ label: f.label, actual: null as number | null, forecast: f.forecast }));
    if (past.length && fut.length) past[past.length - 1] = { ...past[past.length - 1], forecast: past[past.length - 1].actual };
    return [...past, ...fut];
  }, [series, forecast]);

  const trend = forecast.length && series.length
    ? Math.round(((forecast[forecast.length - 1].forecast - series[series.length - 1].count) / Math.max(1, series[series.length - 1].count)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Predictive Intelligence</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">Crime <span className="gradient-text">Forecast</span></h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Historical Months" value={series.length} icon={TrendingUp} />
        <Stat label="Forecast Horizon" value={forecast.length} icon={TrendingUp} suffix=" mo" />
        <Stat label="Projected Δ" value={trend} icon={AlertOctagon} suffix="%" warn />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="font-display font-semibold mb-4">6-Month Forecast (Linear Trend)</div>
        <div className="h-[420px]">
          <ResponsiveContainer>
            <ComposedChart data={merged}>
              <defs>
                <linearGradient id="fa" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.22 245)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.72 0.22 245)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.5 0.1 280 / 0.15)" />
              <XAxis dataKey="label" stroke="oklch(0.7 0.04 260)" fontSize={11} />
              <YAxis stroke="oklch(0.7 0.04 260)" fontSize={11} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.04 268)", border: "1px solid oklch(0.5 0.1 280 / 0.4)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="actual" name="Actual" stroke="oklch(0.7 0.27 305)" fill="url(#fa)" strokeWidth={2} />
              <Line dataKey="forecast" name="Forecast" stroke="oklch(0.85 0.16 200)" strokeDasharray="6 4" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, suffix = "", warn = false }: any) {
  const color = warn ? (value > 0 ? "var(--danger)" : "var(--success)") : "var(--neon-cyan)";
  return (
    <div className="glass rounded-xl p-5 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-bold mt-2" style={warn ? { color } : undefined}>
          {value > 0 && warn ? "+" : ""}{value.toLocaleString()}{suffix}
        </div>
      </div>
      <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${color}22`, color }}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}
