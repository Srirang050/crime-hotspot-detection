import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Shield, Brain, Map, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-radial)" }} />

      <header className="relative z-10 max-w-7xl mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg neon-border grid place-items-center bg-background/40">
            <Shield className="h-4 w-4" style={{ color: "var(--neon-cyan)" }} />
          </div>
          <div className="font-display font-bold tracking-widest gradient-text">SENTINEL</div>
        </div>
        <div className="flex gap-2">
          <Link to="/login" className="px-4 py-2 text-sm rounded-lg hover:bg-secondary/40 transition">Sign in</Link>
          <Link to="/signup" className="px-4 py-2 text-sm rounded-lg neon-border bg-background/40 hover:bg-background/60 transition">Get access</Link>
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--neon-cyan)" }} />
          AI Intelligence Platform · v1.0
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}
          className="font-display text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
          Crime Pattern Analysis & <span className="gradient-text">Hotspot Detection</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-6 text-muted-foreground max-w-2xl mx-auto text-lg">
          Detect dense crime regions, surface anomalies, and forecast risk using K-Means, DBSCAN, and Isolation Forest — all in one futuristic command center.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/signup" className="group px-6 py-3 rounded-lg font-medium text-primary-foreground glow-primary transition hover:scale-[1.02]"
            style={{ background: "var(--gradient-primary)" }}>
            Launch Dashboard <ArrowRight className="inline h-4 w-4 ml-1 group-hover:translate-x-0.5 transition" />
          </Link>
          <Link to="/login" className="px-6 py-3 rounded-lg glass hover:bg-secondary/40 transition">Sign in</Link>
        </motion.div>

        <div className="mt-24 grid md:grid-cols-3 gap-4">
          {[
            { icon: Map, title: "Hotspot Maps", body: "Live heatmaps and clustered overlays on interactive Leaflet maps." },
            { icon: Brain, title: "ML Pipelines", body: "K-Means, DBSCAN, and Isolation Forest run in your browser instantly." },
            { icon: Activity, title: "Risk Forecast", body: "Project monthly crime trends and surface high-risk zones." },
          ].map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
              className="glass rounded-xl p-6 text-left hover:border-primary/40 transition">
              <f.icon className="h-6 w-6 mb-3" style={{ color: "var(--neon-cyan)" }} />
              <div className="font-display font-semibold mb-1">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.body}</div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
