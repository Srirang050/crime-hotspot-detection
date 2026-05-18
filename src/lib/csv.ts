import Papa from "papaparse";

export type ParsedCrime = {
  occurred_at: string | null;
  primary_type: string | null;
  description: string | null;
  location_description: string | null;
  arrest: boolean | null;
  domestic: boolean | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};

const num = (v: any) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
const bool = (v: any) => v == null || v === "" ? null : ["true","t","1","yes","y"].includes(String(v).toLowerCase());
const str = (v: any) => v == null || v === "" ? null : String(v).trim();

function pick(row: Record<string, any>, keys: string[]): any {
  for (const k of keys) for (const rk of Object.keys(row)) if (rk.toLowerCase().trim() === k.toLowerCase()) return row[rk];
  return null;
}

function rowToCrime(row: Record<string, any>): ParsedCrime | null {
  const lat = num(pick(row, ["latitude", "lat", "y coordinate", "y_coordinate", "y", "latitude_y", "lat_y"]));
  const lng = num(pick(row, ["longitude", "lng", "lon", "long", "x coordinate", "x_coordinate", "x", "longitude_x", "lon_x"]));
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const date = pick(row, ["date", "occurred_at", "datetime", "occurrence_date", "report date", "report_date", "incident_date", "incident date", "occurred_on", "occurred_date", "date_occurred", "date_reported", "event_date", "timestamp", "time"]);
  let occurred_at: string | null = null;
  if (date) { const d = new Date(date); if (!isNaN(+d)) occurred_at = d.toISOString(); }
  return {
    occurred_at,
    primary_type: str(pick(row, ["primary type", "primary_type", "type", "category", "offense", "offense_type", "offence", "crime", "crime_type", "crime type", "incident_type", "incident type", "offense_category", "ucr_category"])),
    description: str(pick(row, ["description", "desc", "offense_description", "offence_description", "crime_description", "details", "summary", "narrative"])),
    location_description: str(pick(row, ["location description", "location_description", "location", "place", "address", "premise", "premise_description", "place_of_occurrence"])),
    arrest: bool(pick(row, ["arrest"])),
    domestic: bool(pick(row, ["domestic"])),
    district: str(pick(row, ["district", "beat", "ward", "precinct", "zone", "neighborhood", "neighbourhood", "borough", "area", "division", "sector"])),
    latitude: lat, longitude: lng,
  };
}

export function parseCrimeCsv(file: File): Promise<ParsedCrime[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) => {
        const out: ParsedCrime[] = [];
        for (const row of res.data) { const c = rowToCrime(row); if (c) out.push(c); }
        resolve(out);
      },
      error: reject,
    });
  });
}

export type StreamResult = { sample: ParsedCrime[]; totalRows: number; validRows: number };

/**
 * Streaming parser with reservoir sampling. Handles files of any size (incl. multi-GB)
 * without loading everything into memory. If validRows <= sampleSize, returns all valid rows.
 * Otherwise returns a uniform random sample of size `sampleSize`.
 */
export function parseCrimeCsvStream(
  file: File,
  sampleSize: number,
  onProgress?: (p: { rows: number; valid: number; bytesRead: number; totalBytes: number }) => void,
): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const reservoir: ParsedCrime[] = [];
    let totalRows = 0;
    let validRows = 0;
    let lastTick = 0;

    Papa.parse<Record<string, any>>(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false, worker: false,
      chunkSize: 1024 * 1024 * 4, // 4MB chunks
      chunk: (results, parser) => {
        for (const row of results.data) {
          totalRows++;
          const c = rowToCrime(row);
          if (!c) continue;
          validRows++;
          if (reservoir.length < sampleSize) {
            reservoir.push(c);
          } else {
            const j = Math.floor(Math.random() * validRows);
            if (j < sampleSize) reservoir[j] = c;
          }
        }
        const now = Date.now();
        if (onProgress && now - lastTick > 200) {
          lastTick = now;
          const bytesRead = (parser as any)?.getCharIndex?.() ?? 0;
          onProgress({ rows: totalRows, valid: validRows, bytesRead, totalBytes: file.size });
        }
      },
      complete: () => resolve({ sample: reservoir, totalRows, validRows }),
      error: reject,
    });
  });
}
