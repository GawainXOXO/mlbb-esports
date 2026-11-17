import type { Pool } from "pg";
import { type League, RONE_ENDPOINTS, roneGet } from "../sources/rone/client";
import { type ImportResult, importPayload } from "./import";
import type { TournamentRef } from "./normalize-schedule";

// Tarikan manual dari tombol admin. Aturan (spesifikasi 4.4, NFR-11):
// - mati kecuali RONE_MANUAL_PULL=on, dan selalu mati di produksi sampai login admin ada (M3);
// - satu klik = satu permintaan, jeda minimal antarpermintaan ke Rone;
// - endpoint yang sama dalam 5 menit memakai respons yang tersimpan, tanpa memanggil Rone lagi.

export const CACHE_MS = 5 * 60 * 1000;

export function manualPullEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RONE_MANUAL_PULL === "on" && env.NODE_ENV !== "production";
}

export function minIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const value = Number(env.RONE_MIN_INTERVAL_MS ?? 2000);
  return Number.isFinite(value) && value >= 2000 ? value : 2000;
}

export type PullRequest =
  | {
      kind: "schedule" | "playoffs";
      league: League;
      tournament: TournamentRef;
      createUnknownPlayers: boolean;
    }
  | {
      kind: "match";
      league: League;
      matchId: string;
      tournament: TournamentRef;
      createUnknownPlayers: boolean;
    };

export type PullResult = ImportResult & { cached?: boolean };

/** Dipanggil tombol admin. */
export async function pullOnce(pool: Pool, req: PullRequest): Promise<PullResult> {
  if (!manualPullEnabled()) {
    return { ok: false, logId: null, error: "Tarik data dari Rone sedang dimatikan (RONE_MANUAL_PULL)." };
  }
  return fetchAndImport(pool, req);
}

/** Satu permintaan dengan cache 5 menit dan jeda minimal. */
async function fetchAndImport(pool: Pool, req: PullRequest): Promise<PullResult> {
  const endpoint =
    req.kind === "match"
      ? RONE_ENDPOINTS.match(req.league, req.matchId)
      : RONE_ENDPOINTS[req.kind](req.league);

  const recent = await pool.query<{ id: string; payload: unknown; fetched_at: Date }>(
    `SELECT l.id, l.payload, l.fetched_at FROM ingest_log l JOIN data_source d ON d.id = l.source_id
     WHERE d.code = 'rone' AND l.endpoint = $1 AND l.status_code = 200 AND l.fetched_at > now() - $2::interval
     ORDER BY l.fetched_at DESC LIMIT 1`,
    [endpoint, `${CACHE_MS / 1000} seconds`],
  );
  if (recent.rows[0]) {
    const result = await importPayload(pool, {
      endpoint,
      status: 200,
      payload: recent.rows[0].payload,
      tournament: req.tournament,
      createUnknownPlayers: req.createUnknownPlayers,
      existingLogId: Number(recent.rows[0].id),
    });
    return { ...result, cached: true };
  }

  const last = await pool.query<{ age_ms: number }>(
    `SELECT EXTRACT(EPOCH FROM (now() - max(l.fetched_at))) * 1000 AS age_ms
     FROM ingest_log l JOIN data_source d ON d.id = l.source_id
     WHERE d.code = 'rone' AND l.endpoint LIKE '/api/%'`,
  );
  const age = last.rows[0]?.age_ms;
  if (age != null && Number(age) < minIntervalMs()) {
    return { ok: false, logId: null, error: "Terlalu cepat. Tunggu beberapa detik lalu klik lagi." };
  }

  let response: Awaited<ReturnType<typeof roneGet>>;
  try {
    response = await roneGet(endpoint);
  } catch (error) {
    return {
      ok: false,
      logId: null,
      error: `Rone tidak bisa dihubungi: ${error instanceof Error ? error.message : error}`,
    };
  }
  return importPayload(pool, {
    endpoint,
    status: response.status,
    payload: response.body,
    tournament: req.tournament,
    createUnknownPlayers: req.createUnknownPlayers,
  });
}
