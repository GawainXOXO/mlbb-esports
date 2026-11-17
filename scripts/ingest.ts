import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { describeResult, importPayload } from "../lib/ingest/import";
import { isLeague, type League } from "../lib/sources/rone/client";

// Tidak memanggil Rone. Tarikan dari Rone hanya lewat tombol di /admin/rone.
//   pnpm ingest import <berkas.json | folder> [--create-unknown-players]   impor berkas JSON yang disimpan manual
//   pnpm ingest replay <id ingest_log>                                      olah ulang respons tersimpan
//   pnpm ingest freeze                                                      bekukan seri lama (DR-17)
// Opsi turnamen: --league=id --tournament=mpl-id-s18 --tournament-name="MPL ID Season 18"

const args = process.argv.slice(2);
const job = args[0];
const flag = (name: string) =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const has = (name: string) => args.includes(`--${name}`);
const positional = args.slice(1).filter((a) => !a.startsWith("--"));

const leagueArg = flag("league") ?? process.env.RONE_LEAGUE ?? "id";
if (!isLeague(leagueArg)) {
  console.error(`Liga tidak dikenal: ${leagueArg}`);
  process.exit(1);
}
const league: League = leagueArg;
const tournament = {
  slug: flag("tournament") ?? process.env.RONE_TOURNAMENT_SLUG ?? "mpl-id-s18",
  name: flag("tournament-name") ?? process.env.RONE_TOURNAMENT_NAME ?? "MPL ID Season 18",
  leagueCode: league,
};
const createUnknownPlayers = has("create-unknown-players");

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diisi");
  process.exit(1);
}
const pool = new Pool({ connectionString: url, max: 1 });
let exitCode = 0;

function report(label: string, result: Awaited<ReturnType<typeof importPayload>>) {
  if (!result.ok) exitCode = 1;
  console.log(`${label}: ${describeResult(result)}`);
}

function jsonFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => {
      // Jadwal dan playoff lebih dulu, supaya seri sudah ada saat detail match diimpor.
      const rank = (f: string) => (/schedule|playoff/i.test(f) ? 0 : 1);
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map((f) => join(path, f));
}

try {
  if (job === "import") {
    if (positional.length === 0) throw new Error("Sebutkan berkas atau folder JSON.");
    for (const file of positional.flatMap(jsonFiles)) {
      let payload: unknown;
      try {
        payload = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        console.log(`${file}: bukan JSON yang valid, dilewati`);
        exitCode = 1;
        continue;
      }
      report(
        file,
        await importPayload(pool, {
          endpoint: `file:${file}`,
          status: null,
          payload,
          tournament,
          createUnknownPlayers,
        }),
      );
    }
  } else if (job === "replay") {
    const id = Number(positional[0]);
    const { rows } = await pool.query<{ endpoint: string; status_code: number | null; payload: unknown }>(
      "SELECT endpoint, status_code, payload FROM ingest_log WHERE id = $1",
      [id],
    );
    if (!rows[0]) throw new Error(`ingest_log ${id} tidak ada`);
    report(
      `replay ${id}`,
      await importPayload(pool, {
        ...rows[0],
        status: rows[0].status_code,
        tournament,
        createUnknownPlayers,
        existingLogId: id,
      }),
    );
  } else if (job === "freeze") {
    const { rowCount } = await pool.query(
      `UPDATE series SET frozen_at = now()
       WHERE status = 'finished' AND frozen_at IS NULL AND start_at < now() - interval '7 days'`,
    );
    console.log(`${rowCount} seri dibekukan (DR-17).`);
  } else {
    console.error("Pemakaian: pnpm ingest <import|replay|freeze> ...");
    exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  await pool.end();
}
process.exit(exitCode);
