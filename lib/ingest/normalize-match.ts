import { isSeriesDecided, scoreFromGames } from "../rules/series";
import { heroIdFromImage, parseDuration, slugify, teamSlug } from "../sources/rone/parse";
import type { RoneGame, RoneMatchDetail, RonePlayer } from "../sources/rone/schemas";
import { type Db, overriddenColumns, uniqueSlug, updateUnlocked } from "./db";

export type MatchSummary = {
  matchId: string;
  gamesWritten: number;
  gamesHeld: { game: number; reason: string }[];
  warnings: string[];
  skipped?: string;
};

type SeriesRow = {
  id: string;
  best_of: number;
  score_a: number;
  score_b: number;
  frozen_at: Date | null;
  start_at: Date | null;
  team_a_id: number;
  team_b_id: number;
  a_slug: string;
  b_slug: string;
};

type ResolvedPlayer = { src: RonePlayer; teamId: number; playerId: number; heroId: number };

/** Menyimpan semua game satu seri dalam satu transaksi (spesifikasi 7.2). Pemanggil yang membuka transaksi. */
export async function normalizeMatchDetail(
  db: Db,
  detail: RoneMatchDetail,
  ctx: { sourceId: number; fetchedAt: Date; createUnknownPlayers: boolean },
): Promise<MatchSummary> {
  const summary: MatchSummary = { matchId: detail.match_id, gamesWritten: 0, gamesHeld: [], warnings: [] };
  const { rows } = await db.query<SeriesRow>(
    `SELECT s.id, s.best_of, s.score_a, s.score_b, s.frozen_at, s.start_at, s.team_a_id, s.team_b_id,
            ta.slug AS a_slug, tb.slug AS b_slug
     FROM series_external_id e
     JOIN series s ON s.id = e.series_id
     JOIN team ta ON ta.id = s.team_a_id
     JOIN team tb ON tb.id = s.team_b_id
     WHERE e.source_id = $1 AND e.external_id = $2`,
    [ctx.sourceId, detail.match_id],
  );
  const series = rows[0];
  if (!series) {
    summary.skipped = "seri belum ada. Impor jadwal (schedule.json atau playoffs.json) lebih dulu";
    return summary;
  }
  if (series.frozen_at) {
    summary.skipped = "seri sudah dibekukan (DR-17)";
    return summary;
  }

  const results: { winner: "a" | "b" | null }[] = [];
  for (const game of [...detail.games].sort((x, y) => x.number - y.number)) {
    if (game.number > series.best_of) {
      summary.gamesHeld.push({ game: game.number, reason: `nomor game melebihi BO${series.best_of}` });
      continue;
    }
    await db.query("SAVEPOINT game");
    try {
      const resolved = await resolveGame(db, game, series, ctx);
      if ("held" in resolved) {
        await db.query("RELEASE SAVEPOINT game");
        summary.gamesHeld.push({ game: game.number, reason: resolved.held });
        continue;
      }
      await writeGame(db, series, game, resolved, ctx);
      await db.query("RELEASE SAVEPOINT game");
      summary.gamesWritten++;
      results.push({ winner: resolved.winner });
    } catch (error) {
      await db.query("ROLLBACK TO SAVEPOINT game");
      summary.gamesHeld.push({
        game: game.number,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // DR-03: bandingkan skor dari game dengan skor sumber.
  if (summary.gamesHeld.length === 0 && results.length > 0) {
    const computed = scoreFromGames(results);
    if (computed.a !== series.score_a || computed.b !== series.score_b) {
      summary.warnings.push(
        `skor dari game ${computed.a}-${computed.b} berbeda dari skor sumber ${series.score_a}-${series.score_b}, perlu ditinjau`,
      );
    } else if (!isSeriesDecided(series.best_of, computed)) {
      summary.warnings.push(`skor ${computed.a}-${computed.b} belum menentukan pemenang BO${series.best_of}`);
    }
  }
  return summary;
}

async function resolveGame(
  db: Db,
  game: RoneGame,
  series: SeriesRow,
  ctx: { sourceId: number; createUnknownPlayers: boolean },
): Promise<{ held: string } | { players: ResolvedPlayer[]; winner: "a" | "b" | null }> {
  if (game.teams.length !== 2) return { held: `jumlah tim ${game.teams.length}, seharusnya 2` };

  let winner: "a" | "b" | null = null;
  const players: ResolvedPlayer[] = [];
  const unknown: string[] = [];
  for (const side of game.teams) {
    const slug = teamSlug(side.team.name);
    const which = slug === series.a_slug ? "a" : slug === series.b_slug ? "b" : null;
    if (!which) return { held: `tim "${side.team.name}" tidak ada di seri ini` };
    if (side.players.length !== 5)
      return { held: `tim ${side.team.name} punya ${side.players.length} pemain (DR-04)` };
    if (side.winner) winner = which;
    const teamId = which === "a" ? series.team_a_id : series.team_b_id;
    for (const p of side.players) {
      const playerId = await resolvePlayer(db, p.name, teamId, series.start_at, ctx);
      if (playerId === null) {
        unknown.push(p.name);
        continue;
      }
      players.push({ src: p, teamId, playerId, heroId: await resolveHero(db, p.hero.name, p.hero.image) });
    }
  }
  if (unknown.length) return { held: `pemain tidak dikenal (DR-14): ${unknown.join(", ")}` };

  const heroes = new Set(players.map((p) => p.heroId));
  if (heroes.size !== players.length) return { held: "hero yang sama muncul dua kali (DR-04)" };
  const ids = new Set(players.map((p) => p.playerId));
  if (ids.size !== players.length) return { held: "satu pemain muncul dua kali" };
  return { players, winner };
}

/** DR-14: alias dulu, lalu nickname di roster tim pada tanggal game. Pemain baru hanya bila diizinkan. */
async function resolvePlayer(
  db: Db,
  name: string,
  teamId: number,
  date: Date | null,
  ctx: { sourceId: number; createUnknownPlayers: boolean },
): Promise<number | null> {
  const alias = await db.query<{ player_id: number }>(
    "SELECT player_id FROM player_alias WHERE alias = $1 AND source_id = $2",
    [name, ctx.sourceId],
  );
  if (alias.rows[0]) return alias.rows[0].player_id;

  const roster = await db.query<{ id: number }>(
    `SELECT p.id FROM player p JOIN roster_membership r ON r.player_id = p.id
     WHERE r.team_id = $1 AND lower(p.nickname) = lower($2)
       AND r.from_date <= COALESCE($3::date, current_date)
       AND (r.to_date IS NULL OR r.to_date >= COALESCE($3::date, current_date))
     LIMIT 1`,
    [teamId, name, date],
  );
  if (roster.rows[0]) return roster.rows[0].id;
  if (!ctx.createUnknownPlayers) return null;

  const slug = await uniqueSlug(db, "player", name);
  const created = await db.query<{ id: number }>(
    "INSERT INTO player (slug, nickname) VALUES ($1, $2) RETURNING id",
    [slug, name],
  );
  const playerId = created.rows[0].id;
  await db.query("INSERT INTO player_alias (alias, source_id, player_id) VALUES ($1, $2, $3)", [
    name,
    ctx.sourceId,
    playerId,
  ]);
  return playerId;
}

/**
 * DR-15: hero dicocokkan lewat nama. Bila belum ada, pakai ID game dari gambar bila tersedia.
 * Bila tidak ada ID sama sekali, dibuat entitas sementara ber-ID negatif untuk ditinjau.
 */
async function resolveHero(db: Db, name: string, image: string | null | undefined): Promise<number> {
  const byName = await db.query<{ id: number }>("SELECT id FROM hero WHERE lower(name) = lower($1)", [name]);
  if (byName.rows[0]) return byName.rows[0].id;

  const gameId = heroIdFromImage(image);
  if (gameId !== null) {
    const byId = await db.query<{ id: number }>("SELECT id FROM hero WHERE id = $1", [gameId]);
    if (byId.rows[0]) return gameId;
    await db.query("INSERT INTO hero (id, slug, name) VALUES ($1, $2, $3)", [
      gameId,
      await uniqueSlug(db, "hero", name),
      name,
    ]);
    return gameId;
  }
  const { rows } = await db.query<{ id: number }>(
    "SELECT LEAST(COALESCE(MIN(id), 0), 0) - 1 AS id FROM hero",
  );
  const provisional = rows[0].id;
  await db.query("INSERT INTO hero (id, slug, name) VALUES ($1, $2, $3)", [
    provisional,
    await uniqueSlug(db, "hero", name),
    name,
  ]);
  return provisional;
}

async function ensureMaster(db: Db, table: "item" | "emblem" | "talent", id: number, label: string) {
  await db.query(`INSERT INTO ${table} (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
    id,
    `${label} ${id}`,
  ]);
}

function int(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

async function writeGame(
  db: Db,
  series: SeriesRow,
  game: RoneGame,
  resolved: { players: ResolvedPlayer[]; winner: "a" | "b" | null },
  ctx: { sourceId: number; fetchedAt: Date },
): Promise<void> {
  const winnerTeamId =
    resolved.winner === "a" ? series.team_a_id : resolved.winner === "b" ? series.team_b_id : null;
  const gameValues = {
    duration_sec: parseDuration(game.duration),
    winner_team_id: winnerTeamId,
    status: winnerTeamId ? "finished" : "live",
    source_id: ctx.sourceId,
    fetched_at: ctx.fetchedAt,
  };

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO game (series_id, game_no, duration_sec, winner_team_id, status, source_id, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (series_id, game_no) DO NOTHING RETURNING id`,
    [series.id, game.number, ...Object.values(gameValues)],
  );
  let gameId = inserted.rows[0]?.id;
  if (!gameId) {
    const found = await db.query<{ id: string }>(
      "SELECT id FROM game WHERE series_id = $1 AND game_no = $2",
      [series.id, game.number],
    );
    gameId = found.rows[0].id;
    const locked = await overriddenColumns(db, "game", `game:${gameId}`);
    await updateUnlocked(db, "game", { id: gameId }, gameValues, locked);
  }

  // Baris statistik dari sumber yang tidak lagi ada di data game dibuang (DR-22).
  await db.query(
    "DELETE FROM game_player_stat WHERE game_id = $1 AND source_id = $2 AND NOT (player_id = ANY($3::int[]))",
    [gameId, ctx.sourceId, resolved.players.map((p) => p.playerId)],
  );

  for (const p of resolved.players) {
    const emblemId = p.src.emblem ? Number(p.src.emblem.id) : null;
    if (emblemId !== null) await ensureMaster(db, "emblem", emblemId, "Emblem");
    const statValues = {
      team_id: p.teamId,
      hero_id: p.heroId,
      kills: p.src.kills ?? null,
      deaths: p.src.deaths ?? null,
      assists: p.src.assists ?? null,
      gold: int(p.src.gold),
      damage_dealt: int(p.src.damage_dealt),
      damage_taken: int(p.src.damage_taken),
      tower_damage: int(p.src.tower_damage),
      emblem_id: emblemId,
      source_id: ctx.sourceId,
      fetched_at: ctx.fetchedAt,
    };
    const ins = await db.query(
      `INSERT INTO game_player_stat (game_id, player_id, ${Object.keys(statValues).join(", ")})
       VALUES ($1, $2, ${Object.keys(statValues)
         .map((_, i) => `$${i + 3}`)
         .join(", ")})
       ON CONFLICT (game_id, player_id) DO NOTHING`,
      [gameId, p.playerId, ...Object.values(statValues)],
    );
    if (!ins.rowCount) {
      const locked = await overriddenColumns(
        db,
        "game_player_stat",
        `game_player_stat:${gameId}:${p.playerId}`,
      );
      await updateUnlocked(
        db,
        "game_player_stat",
        { game_id: gameId, player_id: p.playerId },
        statValues,
        locked,
      );
    }

    // Item dan talent diganti utuh setiap sinkronisasi (spesifikasi 7.2), paling banyak 6 item (DR-07).
    const itemsLocked = await overriddenColumns(
      db,
      "game_player_item",
      `game_player_stat:${gameId}:${p.playerId}`,
    );
    if (!itemsLocked.has("*")) {
      await db.query("DELETE FROM game_player_item WHERE game_id = $1 AND player_id = $2", [
        gameId,
        p.playerId,
      ]);
      for (const [index, item] of p.src.items.slice(0, 6).entries()) {
        await ensureMaster(db, "item", Number(item.id), "Item");
        await db.query(
          "INSERT INTO game_player_item (game_id, player_id, slot_no, item_id) VALUES ($1, $2, $3, $4)",
          [gameId, p.playerId, index + 1, Number(item.id)],
        );
      }
    }
    await db.query("DELETE FROM game_player_talent WHERE game_id = $1 AND player_id = $2", [
      gameId,
      p.playerId,
    ]);
    for (const talent of new Set(p.src.talents.map((t) => Number(t.id)))) {
      await ensureMaster(db, "talent", talent, "Talent");
      await db.query("INSERT INTO game_player_talent (game_id, player_id, talent_id) VALUES ($1, $2, $3)", [
        gameId,
        p.playerId,
        talent,
      ]);
    }
  }

  // DR-06: pick mengikuti statistik. Urutan pick yang diisi admin tetap dipertahankan.
  await db.query(
    `DELETE FROM draft_action WHERE game_id = $1 AND action_type = 'pick'
       AND NOT (hero_id = ANY($2::int[]))`,
    [gameId, resolved.players.map((p) => p.heroId)],
  );
  for (const p of resolved.players) {
    await db.query(
      `INSERT INTO draft_action (game_id, team_id, action_type, hero_id, player_id, source_id)
       VALUES ($1, $2, 'pick', $3, $4, $5)
       ON CONFLICT (game_id, hero_id) DO UPDATE SET team_id = EXCLUDED.team_id, player_id = EXCLUDED.player_id
       WHERE draft_action.action_type = 'pick'`,
      [gameId, p.teamId, p.heroId, p.playerId, ctx.sourceId],
    );
  }

  // DR-08: Rone tidak memberi patch, jadi bawaan tahap, lalu turnamen, lalu tebakan tanggal.
  await db.query(
    `WITH c AS (
       SELECT ts.patch_id AS sp, t.default_patch_id AS tp,
              (SELECT p.id FROM patch p WHERE p.server = 'original' AND p.released_on <= s.start_at::date
               ORDER BY p.released_on DESC LIMIT 1) AS gp
       FROM series s JOIN tournament t ON t.id = s.tournament_id
       LEFT JOIN tournament_stage ts ON ts.id = s.stage_id
       WHERE s.id = $2)
     UPDATE game SET patch_id = COALESCE(c.sp, c.tp, c.gp),
            patch_origin = CASE WHEN c.sp IS NOT NULL THEN 'stage_default'
                                WHEN c.tp IS NOT NULL THEN 'tournament_default'
                                ELSE 'guessed_by_date' END
     FROM c WHERE game.id = $1 AND game.patch_id IS NULL AND COALESCE(c.sp, c.tp, c.gp) IS NOT NULL`,
    [gameId, series.id],
  );
}

export { slugify };
