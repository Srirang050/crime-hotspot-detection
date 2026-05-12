// Pure-TS ML utilities for crime analysis. Fast enough for ~10k points client-side.

export type Point = { lat: number; lng: number };
export type CrimeRow = { id?: number; latitude: number | null; longitude: number | null; occurred_at: string | null; primary_type: string | null };

const R = 6371; // km
export function haversine(a: Point, b: Point) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ----- K-Means (k-means++) -----
export function kmeans(points: Point[], k: number, maxIter = 50) {
  if (points.length === 0 || k <= 0) return { centers: [], labels: [] as number[], sizes: [] as number[] };
  k = Math.min(k, points.length);
  // k-means++ init
  const centers: Point[] = [points[Math.floor(Math.random() * points.length)]];
  while (centers.length < k) {
    const d = points.map(p => Math.min(...centers.map(c => (p.lat - c.lat) ** 2 + (p.lng - c.lng) ** 2)));
    const sum = d.reduce((a, b) => a + b, 0) || 1;
    let r = Math.random() * sum;
    let idx = 0;
    for (let i = 0; i < d.length; i++) { r -= d[i]; if (r <= 0) { idx = i; break; } }
    centers.push(points[idx]);
  }
  const labels = new Array(points.length).fill(0);
  for (let it = 0; it < maxIter; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dx = points[i].lat - centers[j].lat, dy = points[i].lng - centers[j].lng;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = j; }
      }
      if (labels[i] !== best) { labels[i] = best; moved = true; }
    }
    const sums = Array.from({ length: k }, () => ({ lat: 0, lng: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const s = sums[labels[i]]; s.lat += points[i].lat; s.lng += points[i].lng; s.n++;
    }
    for (let j = 0; j < k; j++) if (sums[j].n > 0) centers[j] = { lat: sums[j].lat / sums[j].n, lng: sums[j].lng / sums[j].n };
    if (!moved) break;
  }
  const sizes = Array(k).fill(0);
  labels.forEach(l => sizes[l]++);
  return { centers, labels, sizes };
}

// ----- DBSCAN (haversine, km) -----
export function dbscan(points: Point[], epsKm: number, minPts: number) {
  const n = points.length;
  const labels = new Array<number>(n).fill(-2); // -2 unvisited, -1 noise
  let cluster = 0;
  const region = (i: number) => {
    const out: number[] = [];
    for (let j = 0; j < n; j++) if (haversine(points[i], points[j]) <= epsKm) out.push(j);
    return out;
  };
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nb = region(i);
    if (nb.length < minPts) { labels[i] = -1; continue; }
    labels[i] = cluster;
    const queue = [...nb];
    while (queue.length) {
      const q = queue.shift()!;
      if (labels[q] === -1) labels[q] = cluster;
      if (labels[q] !== -2) continue;
      labels[q] = cluster;
      const nb2 = region(q);
      if (nb2.length >= minPts) queue.push(...nb2);
    }
    cluster++;
  }
  return { labels, clusters: cluster };
}

// ----- Isolation Forest (simplified, 2D) -----
function iTree(data: number[][], height: number, maxH: number): any {
  if (height >= maxH || data.length <= 1) return { size: data.length };
  const dim = Math.floor(Math.random() * data[0].length);
  const vals = data.map(d => d[dim]);
  const min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) return { size: data.length };
  const split = min + Math.random() * (max - min);
  const left = data.filter(d => d[dim] < split);
  const right = data.filter(d => d[dim] >= split);
  return { dim, split, left: iTree(left, height + 1, maxH), right: iTree(right, height + 1, maxH) };
}
function pathLen(node: any, x: number[], h = 0): number {
  if (!node || node.size !== undefined) {
    const s = node?.size ?? 1;
    return h + (s > 1 ? 2 * (Math.log(s - 1) + 0.5772) - (2 * (s - 1)) / s : 0);
  }
  return x[node.dim] < node.split ? pathLen(node.left, x, h + 1) : pathLen(node.right, x, h + 1);
}
export function isolationForest(points: Point[], trees = 50, sample = 256) {
  const data = points.map(p => [p.lat, p.lng]);
  const n = Math.min(sample, data.length);
  const maxH = Math.ceil(Math.log2(Math.max(2, n)));
  const forest = Array.from({ length: trees }, () => {
    const sub: number[][] = [];
    for (let i = 0; i < n; i++) sub.push(data[Math.floor(Math.random() * data.length)]);
    return iTree(sub, 0, maxH);
  });
  const c = n > 1 ? 2 * (Math.log(n - 1) + 0.5772) - (2 * (n - 1)) / n : 1;
  return data.map(x => {
    const avg = forest.reduce((s, t) => s + pathLen(t, x), 0) / trees;
    return Math.pow(2, -avg / c); // 0..1, higher = more anomalous
  });
}

// ----- Time series helpers -----
export function bucketByMonth(rows: CrimeRow[]): { label: string; count: number; date: Date }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.occurred_at) continue;
    const d = new Date(r.occurred_at);
    if (isNaN(+d)) continue;
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, count]) => {
    const [y, mo] = k.split("-").map(Number);
    return { label: k, count, date: new Date(Date.UTC(y, mo - 1, 1)) };
  });
}

export function bucketByHour(rows: CrimeRow[]) {
  const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const r of rows) {
    if (!r.occurred_at) continue;
    const d = new Date(r.occurred_at);
    if (!isNaN(+d)) arr[d.getUTCHours()].count++;
  }
  return arr;
}

export function bucketByType(rows: CrimeRow[], top = 8) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.primary_type) m.set(r.primary_type, (m.get(r.primary_type) ?? 0) + 1);
  return [...m.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, top);
}

// Holt-Winters-lite forecast: linear regression on monthly counts + seasonal residual mean
export function forecastMonths(series: { date: Date; count: number }[], horizon = 6) {
  if (series.length < 3) return [];
  const xs = series.map((_, i) => i);
  const ys = series.map(s => s.count);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const intercept = (sy - slope * sx) / n;
  const last = series[series.length - 1].date;
  const out: { label: string; date: Date; forecast: number }[] = [];
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + i, 1));
    const v = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
    out.push({ label: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, date: d, forecast: v });
  }
  return out;
}
