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

export function parseCrimeCsv(file: File): Promise<ParsedCrime[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: (res) => {
        const out: ParsedCrime[] = [];
        for (const row of res.data) {
          const lat = num(pick(row, ["latitude", "lat", "y coordinate"]));
          const lng = num(pick(row, ["longitude", "lng", "lon", "x coordinate"]));
          const date = pick(row, ["date", "occurred_at", "datetime", "occurrence_date"]);
          let occurred_at: string | null = null;
          if (date) {
            const d = new Date(date);
            if (!isNaN(+d)) occurred_at = d.toISOString();
          }
          out.push({
            occurred_at,
            primary_type: str(pick(row, ["primary type", "primary_type", "type", "category", "offense"])),
            description: str(pick(row, ["description", "desc"])),
            location_description: str(pick(row, ["location description", "location_description", "location"])),
            arrest: bool(pick(row, ["arrest"])),
            domestic: bool(pick(row, ["domestic"])),
            district: str(pick(row, ["district", "beat", "ward"])),
            latitude: lat,
            longitude: lng,
          });
        }
        resolve(out.filter(r => r.latitude != null && r.longitude != null));
      },
      error: reject,
    });
  });
}
