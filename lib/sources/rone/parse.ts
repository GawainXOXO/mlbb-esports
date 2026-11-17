import type { RoneScheduleMatch } from "./schemas";

export type SeriesStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

const STATUS_MAP: Record<string, SeriesStatus> = {
  scheduled: "scheduled",
  upcoming: "scheduled",
  live: "live",
  ongoing: "live",
  finished: "finished",
  completed: "finished",
  postponed: "postponed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

/** Status Rone ke status kita. Status yang tidak dikenal adalah galat, bukan tebakan. */
export function mapStatus(raw: string): SeriesStatus {
  const status = STATUS_MAP[raw.trim().toLowerCase()];
  if (!status) throw new Error(`Status Rone tidak dikenal: "${raw}"`);
  return status;
}

/** "10:51" atau "1:02:03" ke detik. Nilai kosong atau rusak menjadi null (DR-10, DR-18). */
export function parseDuration(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
  return seconds > 0 ? seconds : null;
}

/** Kode tim Rone (sama dengan team_id di /teams): nama tim dalam huruf kecil. */
export function teamSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugify(text: string): string {
  return teamSlug(text) || "x";
}

/**
 * Sebagian gambar hero dari Rone memuat ID hero game (`.../hero_h/22.png`).
 * Bila ada, itu ID yang dipakai (DR-15). Bila tidak, null.
 */
export function heroIdFromImage(image: string | null | undefined): number | null {
  if (!image) return null;
  const decoded = decodeURIComponent(image);
  const match = decoded.match(/\/hero_h\/(\d+)\.png/);
  return match ? Number(match[1]) : null;
}

export type ScheduleEntry = RoneScheduleMatch & { stage: "Regular Season" | "Playoffs"; week: number | null };

export function flattenDays(
  days: { matches: RoneScheduleMatch[] }[],
  stage: ScheduleEntry["stage"],
  week: number | null = null,
): ScheduleEntry[] {
  return days.flatMap((d) => d.matches.map((m) => ({ ...m, stage, week })));
}
