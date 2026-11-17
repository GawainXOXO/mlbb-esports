import type { PoolClient } from "pg";
import { slugify, teamSlug } from "../sources/rone/parse";

export type Db = PoolClient;

export async function sourceId(db: Db, code: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>("SELECT id FROM data_source WHERE code = $1", [code]);
  if (!rows[0]) throw new Error(`data_source "${code}" tidak ada`);
  return rows[0].id;
}

/** Respons mentah selalu disimpan lebih dulu (spesifikasi 4.3 aturan 2). */
export async function logIngest(
  db: Db,
  entry: {
    sourceId: number;
    endpoint: string;
    status: number | null;
    payload: unknown;
    error?: string | null;
  },
): Promise<number> {
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO ingest_log (source_id, endpoint, status_code, payload, error) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      entry.sourceId,
      entry.endpoint,
      entry.status,
      JSON.stringify(entry.payload ?? null),
      entry.error ?? null,
    ],
  );
  return Number(rows[0].id);
}

export async function setIngestError(db: Db, logId: number, error: string | null): Promise<void> {
  await db.query("UPDATE ingest_log SET error = $2 WHERE id = $1", [logId, error]);
}

/** Kolom yang dikunci admin lewat field_override (DR-11). */
export async function overriddenColumns(db: Db, table: string, rowKey: string): Promise<Set<string>> {
  const { rows } = await db.query<{ column_name: string }>(
    "SELECT column_name FROM field_override WHERE table_name = $1 AND row_key = $2",
    [table, rowKey],
  );
  return new Set(rows.map((r) => r.column_name));
}

/** UPDATE hanya kolom yang tidak dikunci override. Nama kolom berasal dari kode, bukan input luar. */
export async function updateUnlocked(
  db: Db,
  table: string,
  where: Record<string, unknown>,
  values: Record<string, unknown>,
  locked: Set<string>,
): Promise<void> {
  const cols = Object.keys(values).filter((c) => !locked.has(c));
  if (cols.length === 0) return;
  const params: unknown[] = [];
  const set = cols.map((c) => {
    params.push(values[c]);
    return `${c} = $${params.length}`;
  });
  const cond = Object.entries(where).map(([c, v]) => {
    params.push(v);
    return `${c} = $${params.length}`;
  });
  await db.query(`UPDATE ${table} SET ${set.join(", ")} WHERE ${cond.join(" AND ")}`, params);
}

export async function ensureTournament(
  db: Db,
  t: { slug: string; name: string; leagueCode: string },
): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO tournament (slug, name, league_code) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
    [t.slug, t.name, t.leagueCode],
  );
  return rows[0].id;
}

export async function ensureStage(
  db: Db,
  tournamentId: number,
  name: string,
  order: number,
): Promise<number> {
  const found = await db.query<{ id: number }>(
    "SELECT id FROM tournament_stage WHERE tournament_id = $1 AND name = $2",
    [tournamentId, name],
  );
  if (found.rows[0]) return found.rows[0].id;
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO tournament_stage (tournament_id, name, stage_order) VALUES ($1, $2, $3) RETURNING id",
    [tournamentId, name, order],
  );
  return rows[0].id;
}

export async function ensureTeam(db: Db, name: string): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO team (slug, name) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
    [teamSlug(name), name.trim()],
  );
  return rows[0].id;
}

/** Slug unik: "nama", lalu "nama-2", "nama-3", ... */
export async function uniqueSlug(db: Db, table: "player" | "hero", base: string): Promise<string> {
  const root = slugify(base);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const { rowCount } = await db.query(`SELECT 1 FROM ${table} WHERE slug = $1`, [candidate]);
    if (!rowCount) return candidate;
  }
}
