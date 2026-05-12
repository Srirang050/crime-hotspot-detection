import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, accent = "primary", suffix = "" }:
  { label: string; value: number; icon: LucideIcon; accent?: "primary"|"cyan"|"warn"|"danger"; suffix?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => { const c = animate(mv, value, { duration: 1.1, ease: "easeOut" }); return () => c.stop(); }, [value, mv]);
  const color = { primary: "var(--neon-purple)", cyan: "var(--neon-cyan)", warn: "var(--warn)", danger: "var(--danger)" }[accent];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-3xl font-bold">
            <motion.span>{rounded}</motion.span>
            <span className="text-base ml-0.5 text-muted-foreground">{suffix}</span>
          </div>
        </div>
        <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${color}22`, color }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}
