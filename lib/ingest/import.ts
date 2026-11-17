import type { Pool } from "pg";
import { flattenDays } from "../sources/rone/parse";
import { RoneMatchDetail, RonePlayoffs, RoneSchedule } from "../sources/rone/schemas";
import { ensureTournament, logIngest, setIngestError, sourceId } from "./db";
import { type MatchSummary, normalizeMatchDetail } from "./normalize-match";
import { normalizeSchedule, type ScheduleSummary, type TournamentRef } from "./normalize-schedule";

export type PayloadKind = "schedule" | "playoffs" | "match";

export type ImportResult =
  | { ok: true; kind: "schedule" | "playoffs"; logId: number; summary: ScheduleSummary }
  | { ok: true; kind: "match"; logId: number; summary: MatchSummary }
  | { ok: false; logId: number | null; error: string };

/** Mengenali jenis respons dari bentuknya, bukan dari nama berkas. */
export function detectKind(payload: unknown): PayloadKind | null {
  if (RoneSchedule.safeParse(payload).success) return "schedule";
  if (RoneMatchDetail.safeParse(payload).success) return "match";
  if (RonePlayoffs.safeParse(payload).success) return "playoffs";
  return null;
}

export type ImportInput = {
  endpoint: string;
  status: number | null;
  payload: unknown;
  tournament: TournamentRef;
  createUnknownPlayers: boolean;
  /** Pakai ulang baris ingest_log yang sudah ada (olah ulang atau cache), tanpa mencatat baru. */
  existingLogId?: number;
};

/**
 * Satu jalur untuk semua masukan Rone (tombol admin, berkas, olah ulang):
 * simpan mentah, validasi, normalisasi dalam satu transaksi.
 */
export async function importPayload(pool: Pool, input: ImportInput): Promise<ImportResult> {
  const db = await pool.connect();
  let logId: number | null = input.existingLogId ?? null;
  try {
    await db.query("BEGIN");
    const rone = await sourceId(db, "rone");
    const fetchedAt = new Date();
    if (logId === null) {
      logId = await logIngest(db, {
        sourceId: rone,
        endpoint: input.endpoint,
        status: input.status,
        payload: input.payload,
      });
    }
    await db.query("SAVEPOINT normalize");

    const fail = async (error: string): Promise<ImportResult> => {
      await db.query("ROLLBACK TO SAVEPOINT normalize");
      await setIngestError(db, logId as number, error);
      await db.query("COMMIT");
      return { ok: false, logId, error };
    };

    if (input.status !== null && input.status !== 200) return await fail(`HTTP ${input.status}`);
    const kind = detectKind(input.payload);
    if (!kind) return await fail("bentuk respons tidak dikenali (bukan jadwal, playoff, atau detail match)");

    try {
      if (kind === "match") {
        const detail = RoneMatchDetail.parse(input.payload);
        const summary = await normalizeMatchDetail(db, detail, {
          sourceId: rone,
          fetchedAt,
          createUnknownPlayers: input.createUnknownPlayers,
        });
        const problems = [
          summary.skipped,
          ...summary.gamesHeld.map((h) => `game ${h.game}: ${h.reason}`),
          ...summary.warnings,
        ].filter(Boolean);
        await setIngestError(db, logId, problems.length ? problems.join("; ") : null);
        await db.query("COMMIT");
        return { ok: true, kind, logId, summary };
      }

      const tournamentId = await ensureTournament(db, input.tournament);
      const entries =
        kind === "schedule"
          ? RoneSchedule.parse(input.payload).weeks.flatMap((w) =>
              flattenDays(w.days, "Regular Season", w.week ?? null),
            )
          : flattenDays(RonePlayoffs.parse(input.payload).days, "Playoffs");
      const summary = await normalizeSchedule(db, entries, { tournamentId, sourceId: rone, fetchedAt });
      await setIngestError(db, logId, summary.errors.length ? summary.errors.join("; ") : null);
      await db.query("COMMIT");
      return { ok: true, kind, logId, summary };
    } catch (error) {
      return await fail(error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    return { ok: false, logId: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    db.release();
  }
}

export function describeResult(r: ImportResult): string {
  if (!r.ok) return `Gagal: ${r.error}`;
  if (r.kind === "match") {
    const s = r.summary;
    if (s.skipped) return `Match ${s.matchId} dilewati: ${s.skipped}`;
    const held = s.gamesHeld.map((h) => `game ${h.game} ditahan (${h.reason})`);
    return [`Match ${s.matchId}: ${s.gamesWritten} game tersimpan`, ...held, ...s.warnings].join(". ");
  }
  const s = r.summary;
  return [
    `${r.kind === "schedule" ? "Jadwal" : "Playoff"}: ${s.created} seri baru, ${s.updated} diperbarui`,
    s.skippedTbd ? `${s.skippedTbd} dilewati karena lawan belum diketahui` : "",
    s.skippedFrozen ? `${s.skippedFrozen} dilewati karena sudah dibekukan` : "",
    ...s.errors,
  ]
    .filter(Boolean)
    .join(". ");
}
