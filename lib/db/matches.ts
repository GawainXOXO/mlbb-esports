import "server-only";
import { getPool } from "./index";

export type SeriesRow = {
  id: string;
  slug: string;
  start_at: Date | null;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  best_of: number;
  score_a: number;
  score_b: number;
  round_label: string | null;
  tournament: string;
  stage: string | null;
  team_a: string;
  team_b: string;
  team_a_id: number;
  team_b_id: number;
  winner_team_id: number | null;
  games: number;
};

const SERIES_SELECT = `
  SELECT s.id, s.slug, s.start_at, s.status, s.best_of, s.score_a, s.score_b, s.round_label,
         t.name AS tournament, st.name AS stage, ta.name AS team_a, tb.name AS team_b,
         s.team_a_id, s.team_b_id, s.winner_team_id,
         (SELECT count(*)::int FROM game g WHERE g.series_id = s.id AND g.status = 'finished') AS games
  FROM series s
  JOIN tournament t ON t.id = s.tournament_id
  LEFT JOIN tournament_stage st ON st.id = s.stage_id
  JOIN team ta ON ta.id = s.team_a_id
  JOIN team tb ON tb.id = s.team_b_id`;

export async function listUpcoming(limit = 100): Promise<SeriesRow[]> {
  const { rows } = await getPool().query<SeriesRow>(
    `${SERIES_SELECT} WHERE s.status IN ('scheduled', 'live') ORDER BY s.start_at ASC NULLS LAST LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function listResults(
  page: number,
  perPage = 30,
): Promise<{ rows: SeriesRow[]; hasMore: boolean }> {
  const { rows } = await getPool().query<SeriesRow>(
    `${SERIES_SELECT} WHERE s.status = 'finished' ORDER BY s.start_at DESC NULLS LAST, s.id DESC
     LIMIT $1 OFFSET $2`,
    [perPage + 1, (page - 1) * perPage],
  );
  return { rows: rows.slice(0, perPage), hasMore: rows.length > perPage };
}

export async function getSeries(id: string): Promise<SeriesRow | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const { rows } = await getPool().query<SeriesRow>(`${SERIES_SELECT} WHERE s.id = $1`, [id]);
  return rows[0] ?? null;
}

export type PlayerLine = {
  player_id: number;
  player: string;
  player_slug: string;
  hero: string;
  hero_provisional: boolean;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold: number | null;
  damage_dealt: number | null;
  damage_taken: number | null;
  tower_damage: number | null;
  participation_pct: string | null;
  participation_origin: "official" | "estimated" | null;
  is_mvp: boolean;
  emblem: string | null;
  items: { slot: number; id: number; name: string }[];
  talents: { id: number; name: string }[];
};

export type TeamSide = {
  team_id: number;
  team: string;
  kills: number | null;
  total_gold: number | null;
  total_damage: number | null;
  total_damage_taken: number | null;
  total_tower_damage: number | null;
  gold_rows: number;
  players: PlayerLine[];
};

export type GameDetail = {
  id: string;
  game_no: number;
  duration_sec: number | null;
  winner_team_id: number | null;
  patch: string | null;
  patch_origin: string | null;
  battlefield: string | null;
  completeness: "menunggu" | "sebagian" | "lengkap";
  missing: string[];
  sides: TeamSide[];
};

export async function getGames(series: SeriesRow): Promise<GameDetail[]> {
  const pool = getPool();
  const games = await pool.query<
    Omit<GameDetail, "sides" | "missing"> & {
      has_patch: boolean;
      has_battlefield: boolean;
      bans: number;
      bans_expected: number;
      player_rows_with_wp: number;
      player_rows_full_stats: number;
    }
  >(
    `SELECT g.id, g.game_no, g.duration_sec, g.winner_team_id, p.version AS patch, g.patch_origin,
            b.name AS battlefield, c.completeness, c.has_patch, c.has_battlefield, c.bans::int, c.bans_expected::int,
            c.player_rows_with_wp::int, c.player_rows_full_stats::int
     FROM game g
     LEFT JOIN patch p ON p.id = g.patch_id
     LEFT JOIN battlefield b ON b.id = g.battlefield_id
     JOIN v_game_completeness c ON c.game_id = g.id
     WHERE g.series_id = $1 ORDER BY g.game_no`,
    [series.id],
  );
  if (games.rows.length === 0) return [];
  const gameIds = games.rows.map((g) => g.id);

  const [stats, totals] = await Promise.all([
    pool.query<PlayerLine & { game_id: string; team_id: number }>(
      `SELECT s.game_id, s.team_id, s.player_id, pl.nickname AS player, pl.slug AS player_slug,
              h.name AS hero, (h.id < 0) AS hero_provisional,
              s.kills, s.deaths, s.assists, s.gold, s.damage_dealt, s.damage_taken, s.tower_damage,
              vp.participation_pct, vp.participation_origin, s.is_mvp, e.name AS emblem,
              COALESCE((SELECT json_agg(json_build_object('slot', i.slot_no, 'id', i.item_id, 'name', it.name)
                                 ORDER BY i.slot_no)
                        FROM game_player_item i JOIN item it ON it.id = i.item_id
                        WHERE i.game_id = s.game_id AND i.player_id = s.player_id), '[]') AS items,
              COALESCE((SELECT json_agg(json_build_object('id', gt.talent_id, 'name', t.name) ORDER BY gt.talent_id)
                        FROM game_player_talent gt JOIN talent t ON t.id = gt.talent_id
                        WHERE gt.game_id = s.game_id AND gt.player_id = s.player_id), '[]') AS talents
       FROM game_player_stat s
       JOIN player pl ON pl.id = s.player_id
       JOIN hero h ON h.id = s.hero_id
       LEFT JOIN emblem e ON e.id = s.emblem_id
       LEFT JOIN v_game_player_participation vp ON vp.game_id = s.game_id AND vp.player_id = s.player_id
       WHERE s.game_id = ANY($1::bigint[])
       ORDER BY s.game_id, s.team_id, s.player_id`,
      [gameIds],
    ),
    pool.query<{
      game_id: string;
      team_id: number;
      kills: string | null;
      total_gold: string | null;
      total_damage: string | null;
      total_damage_taken: string | null;
      total_tower_damage: string | null;
      gold_rows: string;
    }>("SELECT * FROM v_game_team_totals WHERE game_id = ANY($1::bigint[])", [gameIds]),
  ]);

  const num = (v: string | null) => (v == null ? null : Number(v));
  return games.rows.map((g) => {
    const missing: string[] = [];
    if (!g.has_patch) missing.push("patch");
    if (!g.has_battlefield) missing.push("battlefield");
    if (g.bans < g.bans_expected) missing.push("ban");
    if (g.player_rows_with_wp < 10) missing.push("war participation");
    if (g.player_rows_full_stats < 10) missing.push("statistik pemain");
    const sides: TeamSide[] = [
      [series.team_a_id, series.team_a],
      [series.team_b_id, series.team_b],
    ].map(([teamId, name]) => {
      const t = totals.rows.find((r) => r.game_id === g.id && r.team_id === teamId);
      return {
        team_id: teamId as number,
        team: name as string,
        kills: num(t?.kills ?? null),
        total_gold: num(t?.total_gold ?? null),
        total_damage: num(t?.total_damage ?? null),
        total_damage_taken: num(t?.total_damage_taken ?? null),
        total_tower_damage: num(t?.total_tower_damage ?? null),
        gold_rows: Number(t?.gold_rows ?? 0),
        players: stats.rows.filter((s) => s.game_id === g.id && s.team_id === teamId),
      };
    });
    return {
      id: g.id,
      game_no: g.game_no,
      duration_sec: g.duration_sec,
      winner_team_id: g.winner_team_id,
      patch: g.patch,
      patch_origin: g.patch_origin,
      battlefield: g.battlefield,
      completeness: g.completeness,
      missing,
      sides,
    };
  });
}
