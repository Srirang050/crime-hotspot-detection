import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDatasets } from "@/hooks/use-crimes";
import { useQueryClient } from "@tanstack/react-query";
import { parseCrimeCsvStream } from "@/lib/csv";
import { generateSample } from "@/lib/sample-data";
import { setActiveDatasetId, useActiveDatasetId } from "@/lib/store";
import { motion } from "framer-motion";
import { Upload, Sparkles, Trash2, CheckCircle2, Database, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/datasets")({ component: Datasets });

async function bulkInsert(userId: string, datasetId: string, rows: any[]) {
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(r => ({ ...r, user_id: userId, dataset_id: datasetId }));
    const { error } = await supabase.from("crimes").insert(chunk);
    if (error) throw error;
  }
}

function Datasets() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const datasets = useDatasets();
  const activeId = useActiveDatasetId();
  const [busy, setBusy] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState(50000);
  const [progress, setProgress] = useState<{ pct: number; rows: number } | null>(null);

  async function handleFile(file: File) {
    if (!user) return;
    setBusy(`Streaming ${(file.size / 1048576).toFixed(1)} MB…`);
    setProgress({ pct: 0, rows: 0 });
    try {
      const { sample, totalRows, validRows } = await parseCrimeCsvStream(
        file, sampleSize,
        (p) => setProgress({
          pct: p.totalBytes ? Math.min(99, (p.bytesRead / p.totalBytes) * 100) : 0,
          rows: p.rows,
        }),
      );
      if (sample.length === 0) throw new Error("No valid rows with lat/lng found");
      const name = file.name.replace(/\.csv$/i, "");
      setBusy(`Saving ${sample.length.toLocaleString()} of ${validRows.toLocaleString()} rows…`);
      setProgress({ pct: 100, rows: totalRows });
      const { data: ds, error } = await supabase.from("datasets").insert({
        user_id: user.id, name, row_count: sample.length,
        original_row_count: totalRows, source_filename: file.name, source_bytes: file.size,
      }).select().single();
      if (error) throw error;
      await bulkInsert(user.id, ds.id, sample);
      setActiveDatasetId(ds.id);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      qc.invalidateQueries({ queryKey: ["crimes"] });
      toast.success(
        sample.length < validRows
          ? `Sampled ${sample.length.toLocaleString()} of ${totalRows.toLocaleString()} source rows`
          : `Imported ${sample.length.toLocaleString()} incidents`
      );
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
    finally { setBusy(null); setProgress(null); }
  }

  async function loadSample() {
    if (!user) return;
    setBusy("Generating sample…");
    try {
      const rows = generateSample(1500);
      const { data: ds, error } = await supabase.from("datasets")
        .insert({ user_id: user.id, name: `Chicago Sample ${new Date().toLocaleDateString()}`, row_count: rows.length, original_row_count: rows.length }).select().single();
      if (error) throw error;
      setBusy(`Saving ${rows.length} rows…`);
      await bulkInsert(user.id, ds.id, rows);
      setActiveDatasetId(ds.id);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      qc.invalidateQueries({ queryKey: ["crimes"] });
      toast.success("Sample dataset loaded");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this dataset and all its incidents?")) return;
    const { error } = await supabase.from("datasets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) setActiveDatasetId(null);
    qc.invalidateQueries({ queryKey: ["datasets"] });
    toast.success("Deleted");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data Vault</div>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">Crime <span className="gradient-text">Datasets</span></h1>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-6 cursor-pointer block hover:border-primary/40 transition relative">
          <input type="file" accept=".csv" className="hidden" disabled={!!busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
          <Upload className="h-6 w-6 mb-3" style={{ color: "var(--neon-cyan)" }} />
          <div className="font-display font-semibold">Upload CSV</div>
          <p className="text-sm text-muted-foreground mt-1">Streams any size file (incl. multi-GB). Auto-detects Latitude, Longitude, Date, Primary Type, etc.</p>
        </motion.label>

        <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} disabled={!!busy} onClick={loadSample}
          className="glass rounded-xl p-6 text-left hover:border-primary/40 transition disabled:opacity-50">
          <Sparkles className="h-6 w-6 mb-3" style={{ color: "var(--neon-purple)" }} />
          <div className="font-display font-semibold">Load Sample Dataset</div>
          <p className="text-sm text-muted-foreground mt-1">1,500 synthetic Chicago incidents — instantly explore all features.</p>
        </motion.button>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-5 flex flex-wrap items-center gap-4">
        <Layers className="h-5 w-5" style={{ color: "var(--neon-cyan)" }} />
        <div className="flex-1 min-w-[200px]">
          <div className="font-display font-semibold text-sm">Import sample size</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Large files are streamed and uniformly downsampled. The original row count is preserved on the dataset record.
          </p>
        </div>
        <select
          disabled={!!busy}
          value={sampleSize}
          onChange={(e) => setSampleSize(Number(e.target.value))}
          className="bg-secondary/40 border border-border/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
        >
          <option value={10000}>10,000 rows</option>
          <option value={25000}>25,000 rows</option>
          <option value={50000}>50,000 rows</option>
          <option value={100000}>100,000 rows</option>
          <option value={200000}>200,000 rows</option>
        </select>
      </motion.div>

      {busy && (
        <div className="glass rounded-lg p-4 space-y-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "var(--neon-cyan)" }} /> {busy}
            {progress && <span className="ml-auto text-xs tabular-nums">{progress.rows.toLocaleString()} rows scanned</span>}
          </div>
          {progress && (
            <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${progress.pct}%`, background: "var(--gradient-primary)" }} />
            </div>
          )}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <div className="font-display font-semibold text-sm">Your Datasets</div>
        </div>
        {datasets.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (datasets.data?.length ?? 0) === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No datasets yet — upload a CSV or load the sample above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Imported</th>
                <th className="text-left px-5 py-3">Source rows</th>
                <th className="text-left px-5 py-3">Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {datasets.data!.map(d => (
                <tr key={d.id} className="border-t border-border/40 hover:bg-secondary/20">
                  <td className="px-5 py-3 font-medium">
                    {d.name}
                    {d.source_filename && <div className="text-xs text-muted-foreground font-normal">{d.source_filename}</div>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{d.row_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {(d.original_row_count ?? d.row_count).toLocaleString()}
                    {d.source_bytes ? <span className="text-xs"> · {(d.source_bytes / 1048576).toFixed(1)} MB</span> : null}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => setActiveDatasetId(d.id)}
                        className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition
                        ${activeId === d.id ? "bg-primary/20 text-foreground" : "bg-secondary/40 hover:bg-secondary/60 text-muted-foreground"}`}>
                        {activeId === d.id && <CheckCircle2 className="h-3 w-3" />} {activeId === d.id ? "Active" : "Activate"}
                      </button>
                      <button onClick={() => remove(d.id)} className="text-xs p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
