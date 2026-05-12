import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    nav({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 grid-bg">
      <motion.form onSubmit={submit} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm glass-strong neon-border rounded-2xl p-8 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg grid place-items-center bg-background/40 neon-border">
            <Shield className="h-4 w-4" style={{ color: "var(--neon-cyan)" }} />
          </div>
          <div>
            <div className="font-display font-bold tracking-widest gradient-text">SENTINEL</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Secure access</div>
          </div>
        </div>
        <h1 className="text-2xl font-display font-bold">Sign in</h1>
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        <button disabled={busy} className="w-full py-2.5 rounded-lg font-medium text-primary-foreground glow-primary disabled:opacity-50"
          style={{ background: "var(--gradient-primary)" }}>
          {busy ? "Authenticating…" : "Sign in"}
        </button>
        <div className="text-xs text-center text-muted-foreground">
          No account? <Link to="/signup" className="text-foreground hover:underline">Create one</Link>
        </div>
      </motion.form>
    </div>
  );
}

function Field({ label, type, value, onChange }: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <input required type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg bg-input border border-border/60 focus:border-primary/60 outline-none transition" />
    </label>
  );
}
