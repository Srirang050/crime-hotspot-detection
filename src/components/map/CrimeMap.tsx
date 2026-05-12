import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.heat";

type P = { lat: number; lng: number; weight?: number };
export type Cluster = { lat: number; lng: number; size: number; risk: number };

export function CrimeMap({
  points, clusters, anomalies, height = 520,
}: { points: P[]; clusters?: Cluster[]; anomalies?: P[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false }).setView([41.8781, -87.6298], 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];

    if (points.length) {
      const heat = (L as any).heatLayer(points.map(p => [p.lat, p.lng, p.weight ?? 0.5]), {
        radius: 22, blur: 18, maxZoom: 15,
        gradient: { 0.2: "#3b82f6", 0.4: "#8b5cf6", 0.6: "#ec4899", 0.85: "#f97316", 1.0: "#ef4444" },
      }).addTo(map);
      layersRef.current.push(heat);

      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }

    if (clusters?.length) {
      for (const c of clusters) {
        const radius = Math.min(40, 8 + Math.sqrt(c.size) * 1.8);
        const color = c.risk > 0.7 ? "#ef4444" : c.risk > 0.45 ? "#f97316" : c.risk > 0.25 ? "#a855f7" : "#3b82f6";
        const m = L.circleMarker([c.lat, c.lng], {
          radius, color, weight: 2, fillColor: color, fillOpacity: 0.18,
        }).addTo(map).bindPopup(
          `<div style="font-family:Inter,sans-serif"><b>Hotspot Cluster</b><br/>Incidents: ${c.size}<br/>Risk: ${(c.risk * 100).toFixed(0)}%</div>`
        );
        layersRef.current.push(m);
      }
    }

    if (anomalies?.length) {
      for (const a of anomalies) {
        const m = L.circleMarker([a.lat, a.lng], {
          radius: 5, color: "#fde047", weight: 1.5, fillColor: "#fde047", fillOpacity: 0.9,
        }).addTo(map).bindTooltip("Anomaly");
        layersRef.current.push(m);
      }
    }
  }, [points, clusters, anomalies]);

  return <div ref={ref} className="rounded-xl overflow-hidden neon-border" style={{ height }} />;
}
