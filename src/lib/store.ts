// Lightweight global store (no zustand needed; small surface)
import { useEffect, useSyncExternalStore } from "react";

type State = { activeDatasetId: string | null };
let state: State = { activeDatasetId: typeof window !== "undefined" ? localStorage.getItem("activeDatasetId") : null };
const listeners = new Set<() => void>();

export function setActiveDatasetId(id: string | null) {
  state = { ...state, activeDatasetId: id };
  if (typeof window !== "undefined") {
    if (id) localStorage.setItem("activeDatasetId", id); else localStorage.removeItem("activeDatasetId");
  }
  listeners.forEach(l => l());
}
export function useActiveDatasetId() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state.activeDatasetId,
    () => null,
  );
}
// Hydrate from storage on client
export function useHydrateStore() {
  useEffect(() => {
    const v = localStorage.getItem("activeDatasetId");
    if (v && v !== state.activeDatasetId) setActiveDatasetId(v);
  }, []);
}
