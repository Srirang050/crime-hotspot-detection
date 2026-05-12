// Synthetic Chicago crime sample (around real lat/lng) for instant demo.
const CENTERS = [
  { lat: 41.8781, lng: -87.6298, name: "Loop" },
  { lat: 41.7886, lng: -87.5987, name: "South Side" },
  { lat: 41.9484, lng: -87.6553, name: "Lincoln Park" },
  { lat: 41.8369, lng: -87.6847, name: "Pilsen" },
  { lat: 41.9742, lng: -87.7099, name: "Albany Park" },
];
const TYPES = ["THEFT","BATTERY","ASSAULT","BURGLARY","NARCOTICS","ROBBERY","CRIMINAL DAMAGE","MOTOR VEHICLE THEFT"];

export function generateSample(n = 1200) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const c = CENTERS[Math.floor(Math.random() * CENTERS.length)];
    const lat = c.lat + (Math.random() - 0.5) * 0.04;
    const lng = c.lng + (Math.random() - 0.5) * 0.04;
    const t = TYPES[Math.floor(Math.random() * TYPES.length)];
    const d = new Date(now - Math.random() * 1000 * 60 * 60 * 24 * 365 * 2);
    out.push({
      occurred_at: d.toISOString(),
      primary_type: t,
      description: t,
      location_description: c.name,
      arrest: Math.random() < 0.2,
      domestic: Math.random() < 0.15,
      district: String(1 + Math.floor(Math.random() * 25)),
      latitude: lat,
      longitude: lng,
    });
  }
  return out;
}
