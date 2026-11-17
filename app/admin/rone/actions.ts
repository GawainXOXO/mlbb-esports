"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { describeResult, importPayload } from "@/lib/ingest/import";
import { pullOnce } from "@/lib/ingest/pull";
import { isLeague } from "@/lib/sources/rone/client";

export type ActionState = { ok: boolean; message: string } | null;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function tournamentFrom(form: FormData, league: string) {
  const slug = String(form.get("tournament") || process.env.RONE_TOURNAMENT_SLUG || "mpl-id-s18").trim();
  const name = String(
    form.get("tournamentName") || process.env.RONE_TOURNAMENT_NAME || "MPL ID Season 18",
  ).trim();
  if (!/^[a-z0-9-]{1,60}$/.test(slug))
    throw new Error("Slug turnamen hanya boleh huruf kecil, angka, dan tanda minus.");
  return { slug, name: name.slice(0, 120), leagueCode: league };
}

export async function pullAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!isAdmin()) return { ok: false, message: "Tidak diizinkan." };
  try {
    const league = String(form.get("league") || "id");
    if (!isLeague(league)) return { ok: false, message: "Liga tidak dikenal." };
    const kind = String(form.get("kind"));
    const tournament = tournamentFrom(form, league);
    const createUnknownPlayers = form.get("createUnknownPlayers") === "on";
    let result: Awaited<ReturnType<typeof pullOnce>>;
    if (kind === "match") {
      const matchId = String(form.get("matchId") || "").trim();
      if (!/^[A-Za-z0-9-]{1,40}$/.test(matchId)) return { ok: false, message: "ID match tidak valid." };
      result = await pullOnce(getPool(), { kind, league, matchId, tournament, createUnknownPlayers });
    } else if (kind === "schedule" || kind === "playoffs") {
      result = await pullOnce(getPool(), { kind, league, tournament, createUnknownPlayers });
    } else {
      return { ok: false, message: "Jenis tarikan tidak dikenal." };
    }
    revalidatePath("/", "layout");
    return {
      ok: result.ok,
      message: `${result.cached ? "(dari cache 5 menit) " : ""}${describeResult(result)}`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export async function importFileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!isAdmin()) return { ok: false, message: "Tidak diizinkan." };
  try {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ok: false, message: "Pilih minimal satu berkas JSON." };
    const league = String(form.get("league") || "id");
    if (!isLeague(league)) return { ok: false, message: "Liga tidak dikenal." };
    const tournament = tournamentFrom(form, league);
    const createUnknownPlayers = form.get("createUnknownPlayers") === "on";
    // Jadwal dan playoff dulu, supaya seri sudah ada saat detail match diimpor.
    const parsed: { name: string; payload: unknown; rank: number }[] = [];
    const lines: string[] = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        lines.push(`${file.name}: terlalu besar (maks 5 MB)`);
        continue;
      }
      try {
        const payload = JSON.parse(await file.text());
        const rank = payload && typeof payload === "object" && "games" in payload ? 1 : 0;
        parsed.push({ name: file.name, payload, rank });
      } catch {
        lines.push(`${file.name}: bukan JSON yang valid`);
      }
    }
    let ok = lines.length === 0;
    for (const item of parsed.sort((a, b) => a.rank - b.rank)) {
      const result = await importPayload(getPool(), {
        endpoint: `upload:${item.name.slice(0, 100)}`,
        status: null,
        payload: item.payload,
        tournament,
        createUnknownPlayers,
      });
      ok &&= result.ok;
      lines.push(`${item.name}: ${describeResult(result)}`);
    }
    revalidatePath("/", "layout");
    return { ok, message: lines.join("\n") };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
