import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { resolveTestDatabase } from "../setup/test-db";

const pool = new Pool({ connectionString: resolveTestDatabase().url, max: 1 });
afterAll(() => pool.end());

describe("skema v2 setelah migrasi", () => {
  it("memuat tabel inti dan view", async () => {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = rows.map((r) => r.name);
    for (const t of ["series", "game", "game_player_stat", "draft_action", "v_game_completeness"]) {
      expect(names).toContain(t);
    }
  });

  it("menolak game_no melebihi best_of (DR-02)", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = await client.query("INSERT INTO tournament (slug, name) VALUES ('uji', 'Uji') RETURNING id");
      const teams = await client.query(
        "INSERT INTO team (slug, name) VALUES ('a', 'A'), ('b', 'B') RETURNING id",
      );
      const s = await client.query(
        "INSERT INTO series (slug, tournament_id, team_a_id, team_b_id, best_of) VALUES ('a-vs-b', $1, $2, $3, 3) RETURNING id",
        [t.rows[0].id, teams.rows[0].id, teams.rows[1].id],
      );
      await expect(
        client.query("INSERT INTO game (series_id, game_no) VALUES ($1, 4)", [s.rows[0].id]),
      ).rejects.toThrow(/melebihi best_of/);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
