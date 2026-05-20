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

// Project lat/lng -> local planar km using equirectangular around the mean lat.
// This makes Euclidean distance ≈ true ground distance for a city-sized region,
// which is what makes K-Means / DBSCAN behave correctly on geo data.
function project(points: Point[]) {
  if (points.length === 0) return { xs: new Float64Array(0), ys: new Float64Array(0), lat0: 0, lng0: 0, kx: 111.32, ky: 111.32 };
  let sLat = 0, sLng = 0;
  for (const p of points) { sLat += p.lat; sLng += p.lng; }
  const lat0 = sLat / points.length;
  const lng0 = sLng / points.length;
  const ky = 111.32; // km per deg lat
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180); // km per deg lng at lat0
  const xs = new Float64Array(points.length);
  const ys = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    xs[i] = (points[i].lng - lng0) * kx;
    ys[i] = (points[i].lat - lat0) * ky;
  }
  return { xs, ys, lat0, lng0, kx, ky };
}
function unproject(x: number, y: number, lat0: number, lng0: number, kx: number, ky: number): Point {
  return { lat: lat0 + y / ky, lng: lng0 + x / kx };
}

// ----- K-Means (k-means++, multi-restart, equirectangular km) -----
export function kmeans(points: Point[], k: number, maxIter = 80, restarts = 6) {
  if (points.length === 0 || k <= 0) return { centers: [] as Point[], labels: [] as number[], sizes: [] as number[] };
  k = Math.min(k, points.length);
  const { xs, ys, lat0, lng0, kx, ky } = project(points);
  const n = points.length;

  let bestInertia = Infinity;
  let bestLabels = new Int32Array(n);
  let bestCx = new Float64Array(k);
  let bestCy = new Float64Array(k);

  for (let restart = 0; restart < restarts; restart++) {
    // k-means++ init
    const cx = new Float64Array(k);
    const cy = new Float64Array(k);
    const first = Math.floor(Math.random() * n);
    cx[0] = xs[first]; cy[0] = ys[first];
    const d2 = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - cx[0], dy = ys[i] - cy[0];
      d2[i] = dx * dx + dy * dy;
    }
    for (let c = 1; c < k; c++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += d2[i];
      if (sum <= 0) { cx[c] = xs[Math.floor(Math.random() * n)]; cy[c] = ys[Math.floor(Math.random() * n)]; }
      else {
        let r = Math.random() * sum;
        let idx = n - 1;
        for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { idx = i; break; } }
        cx[c] = xs[idx]; cy[c] = ys[idx];
      }
      for (let i = 0; i < n; i++) {
        const dx = xs[i] - cx[c], dy = ys[i] - cy[c];
        const dd = dx * dx + dy * dy;
        if (dd < d2[i]) d2[i] = dd;
      }
    }

    const labels = new Int32Array(n);
    for (let it = 0; it < maxIter; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        const x = xs[i], y = ys[i];
        for (let j = 0; j < k; j++) {
          const dx = x - cx[j], dy = y - cy[j];
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = j; }
        }
        if (labels[i] !== best) { labels[i] = best; moved = true; }
      }
      const sx = new Float64Array(k), sy = new Float64Array(k), sn = new Int32Array(k);
      for (let i = 0; i < n; i++) { const l = labels[i]; sx[l] += xs[i]; sy[l] += ys[i]; sn[l]++; }
      for (let j = 0; j < k; j++) {
        if (sn[j] > 0) { cx[j] = sx[j] / sn[j]; cy[j] = sy[j] / sn[j]; }
        else {
          // Empty cluster: re-seed from the point farthest from its current center
          let far = 0, fd = -1;
          for (let i = 0; i < n; i++) {
            const dx = xs[i] - cx[labels[i]], dy = ys[i] - cy[labels[i]];
            const dd = dx * dx + dy * dy;
            if (dd > fd) { fd = dd; far = i; }
          }
          cx[j] = xs[far]; cy[j] = ys[far];
          moved = true;
        }
      }
      if (!moved) break;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - cx[labels[i]], dy = ys[i] - cy[labels[i]];
      inertia += dx * dx + dy * dy;
    }
    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestLabels = labels;
      bestCx = cx;
      bestCy = cy;
    }
  }

  const centers: Point[] = [];
  for (let j = 0; j < k; j++) centers.push(unproject(bestCx[j], bestCy[j], lat0, lng0, kx, ky));
  const sizes = Array(k).fill(0);
  const labelsArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) { labelsArr[i] = bestLabels[i]; sizes[bestLabels[i]]++; }
  return { centers, labels: labelsArr, sizes };
}

// ----- DBSCAN (equirectangular km + grid index, true O(n) avg) -----
export function dbscan(points: Point[], epsKm: number, minPts: number) {
  const n = points.length;
  const labels = new Array<number>(n).fill(-2); // -2 unvisited, -1 noise
  if (n === 0) return { labels, clusters: 0 };
  const { xs, ys } = project(points);

  // Build a uniform grid of side = eps km. Neighbor queries scan 9 cells.
  const cell = epsKm;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => cx + "," + cy;
  const cellOf = (i: number) => [Math.floor(xs[i] / cell), Math.floor(ys[i] / cell)] as const;
  for (let i = 0; i < n; i++) {
    const [cx, cy] = cellOf(i);
    const k = key(cx, cy);
    const b = grid.get(k);
    if (b) b.push(i); else grid.set(k, [i]);
  }
  const eps2 = epsKm * epsKm;
  const region = (i: number): number[] => {
    const out: number[] = [];
    const [cx, cy] = cellOf(i);
    const x = xs[i], y = ys[i];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const b = grid.get(key(cx + dx, cy + dy));
      if (!b) continue;
      for (const j of b) {
        const ex = xs[j] - x, ey = ys[j] - y;
        if (ex * ex + ey * ey <= eps2) out.push(j);
      }
    }
    return out;
  };

  let cluster = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== -2) continue;
    const nb = region(i);
    if (nb.length < minPts) { labels[i] = -1; continue; }
    labels[i] = cluster;
    // BFS, dedup via labels to avoid re-querying
    const queue: number[] = [];
    for (const j of nb) if (j !== i && labels[j] !== cluster) { queue.push(j); }
    let head = 0;
    while (head < queue.length) {
      const q = queue[head++];
      if (labels[q] === -1) { labels[q] = cluster; continue; } // border point
      if (labels[q] !== -2) continue;
      labels[q] = cluster;
      const nb2 = region(q);
      if (nb2.length >= minPts) {
        for (const j of nb2) if (labels[j] === -2 || labels[j] === -1) queue.push(j);
      }
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
