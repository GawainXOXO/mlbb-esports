import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importPayload } from "../../lib/ingest/import";
import { matchFixture, scheduleFixture } from "../fixtures/rone/build";
import { resolveTestDatabase } from "../setup/test-db";

const pool = new Pool({ connectionString: resolveTestDatabase().url, max: 2 });
const tournament = { slug: "uji-rone", name: "Turnamen Uji", leagueCode: "id" };
const run = (payload: unknown, createUnknownPlayers = false) =>
  importPayload(pool, { endpoint: "test", status: null, payload, tournament, createUnknownPlayers });
const count = async (sql: string, params: unknown[] = []) =>
  Number((await pool.query<{ n: string }>(sql, params)).rows[0].n);

beforeAll(async () => {
  await pool.query(
    `TRUNCATE ingest_log, field_override, draft_action, game_player_item, game_player_talent, game_player_stat,
              game, series_external_id, series, player_alias, roster_membership, player, team,
              tournament_stage, tournament, hero, item, emblem, talent RESTART IDENTITY CASCADE`,
  );
});
afterAll(() => pool.end());

describe("impor Rone ke database", () => {
  it("jadwal membuat seri dan melewati lawan TBD", async () => {
    const r = await run(scheduleFixture());
    expect(r.ok && r.kind === "schedule" && r.summary).toMatchObject({
      created: 1,
      skippedTbd: 1,
      errors: [],
    });
    expect(await count("SELECT count(*) AS n FROM series")).toBe(1);
    expect(await count("SELECT count(*) AS n FROM ingest_log")).toBe(1);
  });

  it("pemain tidak dikenal menahan game (DR-14)", async () => {
    const r = await run(matchFixture());
    expect(r.ok && r.kind === "match" && r.summary.gamesWritten).toBe(0);
    expect(r.ok && r.kind === "match" && r.summary.gamesHeld[0].reason).toMatch(/pemain tidak dikenal/);
    expect(await count("SELECT count(*) AS n FROM game")).toBe(0);
  });

  it("dengan izin membuat pemain, semua game tersimpan lengkap", async () => {
    const r = await run(matchFixture(), true);
    expect(r.ok && r.kind === "match" && r.summary).toMatchObject({
      gamesWritten: 2,
      gamesHeld: [],
      warnings: [],
    });
    expect(await count("SELECT count(*) AS n FROM game WHERE status = 'finished'")).toBe(2);
    expect(await count("SELECT count(*) AS n FROM game_player_stat")).toBe(20);
    expect(await count("SELECT count(*) AS n FROM draft_action WHERE action_type = 'pick'")).toBe(20);
    expect(await count("SELECT count(*) AS n FROM game_player_item")).toBe(60);
    expect(await count("SELECT count(*) AS n FROM game WHERE duration_sec = 651")).toBe(1);
    expect(await count("SELECT count(*) AS n FROM hero WHERE id = 22 AND name = 'Freya'")).toBe(1);
  });

  it("impor ulang tidak mengubah apa pun (idempoten)", async () => {
    const snapshot = async () =>
      (
        await pool.query(
          `SELECT (SELECT count(*) FROM series) s, (SELECT count(*) FROM game) g, (SELECT count(*) FROM player) p,
                  (SELECT count(*) FROM hero) h, (SELECT count(*) FROM game_player_stat) st,
                  (SELECT count(*) FROM game_player_item) i, (SELECT count(*) FROM draft_action) d,
                  (SELECT sum(gold) FROM game_player_stat) gold`,
        )
      ).rows[0];
    const before = await snapshot();
    await run(scheduleFixture(), true);
    await run(matchFixture(), true);
    expect(await snapshot()).toEqual(before);
  });

  it("kolom ber-override tidak ditimpa (DR-11)", async () => {
    const { rows } = await pool.query<{ game_id: string; player_id: number }>(
      "SELECT game_id, player_id FROM game_player_stat ORDER BY game_id, player_id LIMIT 1",
    );
    const { game_id, player_id } = rows[0];
    await pool.query("UPDATE game_player_stat SET gold = 1234 WHERE game_id = $1 AND player_id = $2", [
      game_id,
      player_id,
    ]);
    await pool.query(
      "INSERT INTO field_override (table_name, row_key, column_name, value, edited_by) VALUES ('game_player_stat', $1, 'gold', '1234', 'uji')",
      [`game_player_stat:${game_id}:${player_id}`],
    );
    await run(matchFixture(), true);
    const gold = await pool.query("SELECT gold FROM game_player_stat WHERE game_id = $1 AND player_id = $2", [
      game_id,
      player_id,
    ]);
    expect(gold.rows[0].gold).toBe(1234);
  });

  it("skor sumber yang berbeda dari hasil game diberi peringatan (DR-03)", async () => {
    await run(scheduleFixture({ score1: 2, score2: 1 }), true);
    const r = await run(matchFixture(), true);
    expect(r.ok && r.kind === "match" && r.summary.warnings[0]).toMatch(/berbeda dari skor sumber/);
  });

  it("respons yang bentuknya tidak dikenal dicatat sebagai galat", async () => {
    const r = await run({ hello: "world" });
    expect(r.ok).toBe(false);
    if (!r.ok && r.logId) {
      const log = await pool.query("SELECT error FROM ingest_log WHERE id = $1", [r.logId]);
      expect(log.rows[0].error).toMatch(/tidak dikenali/);
    }
  });

  it("seri beku tidak disentuh (DR-17)", async () => {
    await pool.query("UPDATE series SET frozen_at = now()");
    const r = await run(matchFixture(), true);
    expect(r.ok && r.kind === "match" && r.summary.skipped).toMatch(/dibekukan/);
  });
});
