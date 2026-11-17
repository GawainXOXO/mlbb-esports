// Pemanggil HTTP Rone. Hanya dipakai saat admin menekan "Tarik data" (satu klik = satu permintaan).
// Tidak ada penjadwal, tidak ada perulangan. Jeda dan cache ditegakkan di lib/ingest/pull.ts.

export type RoneResponse = { endpoint: string; status: number; body: unknown };

const DEFAULT_BASE = "https://arena.rone.dev";

export async function roneGet(endpoint: string): Promise<RoneResponse> {
  const userAgent = process.env.RONE_USER_AGENT?.trim();
  if (!userAgent) {
    throw new Error(
      "RONE_USER_AGENT belum diisi. Isi dengan nama proyek dan tautan repo, tanpa data pribadi.",
    );
  }
  const base = (process.env.RONE_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const res = await fetch(`${base}${endpoint}`, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Biarkan sebagai teks; validasi skema yang akan menolaknya.
  }
  return { endpoint, status: res.status, body };
}

export const LEAGUES = { id: "MPL ID", ph: "MPL PH", my: "MPL MY", kh: "MPL KH" } as const;
export type League = keyof typeof LEAGUES;

export function isLeague(value: string): value is League {
  return value in LEAGUES;
}

export const RONE_ENDPOINTS = {
  schedule: (league: League) => `/api/esports/${league}/schedule`,
  playoffs: (league: League) => `/api/esports/${league}/playoffs`,
  match: (league: League, id: string) => `/api/esports/${league}/matches/${encodeURIComponent(id)}`,
};
