import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Database, Map, Brain, LineChart, LogOut, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/map", label: "Hotspot Map", icon: Map },
  { to: "/analysis", label: "AI Analysis", icon: Brain },
  { to: "/forecast", label: "Forecast", icon: LineChart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex text-foreground">
      <aside className="hidden md:flex w-64 shrink-0 flex-col glass-strong border-r border-border/40 p-5 gap-6 sticky top-0 h-screen">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg neon-border grid place-items-center animate-pulse-glow bg-background/40">
            <Shield className="h-4 w-4 text-[oklch(var(--neon-cyan))]" style={{ color: "var(--neon-cyan)" }} />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-widest gradient-text">SENTINEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Crime Intel</div>
          </div>
        </Link>

        <nav className="flex-1 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link key={to} to={to}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                ${active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}>
                {active && <motion.span layoutId="navdot" className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r"
                  style={{ background: "var(--gradient-primary)" }} />}
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/40 pt-4 space-y-3">
          <div className="text-xs">
            <div className="text-muted-foreground">Signed in</div>
            <div className="truncate font-medium">{user?.email}</div>
          </div>
          <button
            onClick={async () => { await signOut(); nav({ to: "/login" }); }}
            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-destructive/10 transition">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 grid-bg">
        <div className="max-w-[1500px] mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
