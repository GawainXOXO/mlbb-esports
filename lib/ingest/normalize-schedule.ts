import { mapStatus, type ScheduleEntry, slugify } from "../sources/rone/parse";
import { type Db, ensureStage, ensureTeam, overriddenColumns, updateUnlocked } from "./db";

export type TournamentRef = { slug: string; name: string; leagueCode: string };

export type ScheduleSummary = {
  created: number;
  updated: number;
  skippedTbd: number;
  skippedFrozen: number;
  errors: string[];
};

const STAGE_ORDER = { "Regular Season": 1, Playoffs: 2 } as const;

/** Membuat atau memperbarui seri dari jadwal. Satu entri rusak tidak menghentikan yang lain. */
export async function normalizeSchedule(
  db: Db,
  entries: ScheduleEntry[],
  ctx: { tournamentId: number; sourceId: number; fetchedAt: Date },
): Promise<ScheduleSummary> {
  const summary: ScheduleSummary = { created: 0, updated: 0, skippedTbd: 0, skippedFrozen: 0, errors: [] };
  const stageIds = new Map<string, number>();

  for (const m of entries) {
    if (!m.team1 || !m.team2) {
      summary.skippedTbd++;
      continue;
    }
    await db.query("SAVEPOINT entry");
    try {
      let stageId = stageIds.get(m.stage);
      if (stageId === undefined) {
        stageId = await ensureStage(db, ctx.tournamentId, m.stage, STAGE_ORDER[m.stage]);
        stageIds.set(m.stage, stageId);
      }
      const teamA = await ensureTeam(db, m.team1.name);
      const teamB = await ensureTeam(db, m.team2.name);
      const values = {
        tournament_id: ctx.tournamentId,
        stage_id: stageId,
        round_label: m.round ?? (m.week ? `Week ${m.week}` : null),
        team_a_id: teamA,
        team_b_id: teamB,
        best_of: m.best_of,
        score_a: m.score1 ?? 0,
        score_b: m.score2 ?? 0,
        status: mapStatus(m.status),
        start_at: m.start_at ?? null,
        winner_team_id: m.winner === "team1" ? teamA : m.winner === "team2" ? teamB : null,
        source_id: ctx.sourceId,
        fetched_at: ctx.fetchedAt,
      };

      const existing = await db.query<{ id: string; frozen_at: Date | null }>(
        `SELECT s.id, s.frozen_at FROM series_external_id e JOIN series s ON s.id = e.series_id
         WHERE e.source_id = $1 AND e.external_id = $2`,
        [ctx.sourceId, m.match_id],
      );
      const found = existing.rows[0];
      if (found?.frozen_at) {
        summary.skippedFrozen++;
      } else if (found) {
        const locked = await overriddenColumns(db, "series", `series:${found.id}`);
        await updateUnlocked(db, "series", { id: found.id }, values, locked);
        summary.updated++;
      } else {
        const slug = slugify(`${m.team1.name}-vs-${m.team2.name}`);
        const cols = Object.keys(values);
        const { rows } = await db.query<{ id: string }>(
          `INSERT INTO series (slug, ${cols.join(", ")}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}) RETURNING id`,
          [slug, ...Object.values(values)],
        );
        await db.query(
          "INSERT INTO series_external_id (series_id, source_id, external_id) VALUES ($1, $2, $3)",
          [rows[0].id, ctx.sourceId, m.match_id],
        );
        summary.created++;
      }
      await db.query("RELEASE SAVEPOINT entry");
    } catch (error) {
      await db.query("ROLLBACK TO SAVEPOINT entry");
      summary.errors.push(`match ${m.match_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return summary;
}
