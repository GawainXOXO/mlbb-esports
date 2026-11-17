import Link from "next/link";
import type { SeriesRow } from "@/lib/db/matches";
import { wibDateKey, wibDateLabel, wibTime } from "@/lib/time";

function statusOf(s: SeriesRow, now: Date): { label: string; tone: string } {
  if (s.status === "finished") return { label: "Selesai", tone: "text-muted" };
  if (s.status === "postponed") return { label: "Ditunda", tone: "text-muted" };
  if (s.status === "cancelled") return { label: "Batal", tone: "text-muted" };
  // DR-21: lewat jam jadwal berarti berlangsung, tanpa menunggu sumber.
  if (s.status === "live" || (s.start_at && s.start_at <= now))
    return { label: "Berlangsung", tone: "text-accent" };
  return { label: "Mendatang", tone: "text-muted" };
}

export function seriesHref(s: Pick<SeriesRow, "id" | "slug">): string {
  return `/match/${s.id}/${s.slug}`;
}

export function SeriesList({ series, empty }: { series: SeriesRow[]; empty: string }) {
  if (series.length === 0) {
    return <p className="rounded-sm bg-card px-3 py-4 text-muted shadow-sm">{empty}</p>;
  }
  const now = new Date();
  const groups = new Map<string, { label: string; items: SeriesRow[] }>();
  for (const s of series) {
    const key = s.start_at ? wibDateKey(s.start_at) : "tbd";
    const label = s.start_at ? wibDateLabel(s.start_at) : "Tanggal belum diketahui";
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)?.items.push(s);
  }

  return (
    <div className="space-y-4">
      {[...groups.values()].map((g) => (
        <section key={g.label} className="overflow-hidden rounded-sm bg-card shadow-sm">
          <h2 className="border-b border-line bg-card-alt px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
            {g.label}
          </h2>
          <ul>
            {g.items.map((s) => {
              const status = statusOf(s, now);
              const played = s.status === "finished" || s.score_a + s.score_b > 0;
              return (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <Link href={seriesHref(s)} className="flex items-center gap-3 px-3 py-2 hover:bg-card-alt">
                    <span className="w-11 shrink-0 font-semibold tabular-nums text-muted">
                      {s.start_at ? wibTime(s.start_at) : "TBD"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 font-semibold">
                        <span className={s.winner_team_id === s.team_a_id ? "" : played ? "opacity-60" : ""}>
                          {s.team_a}
                        </span>
                        {played && <span className="tabular-nums">{s.score_a}</span>}
                      </span>
                      <span className="flex justify-between gap-2 font-semibold">
                        <span className={s.winner_team_id === s.team_b_id ? "" : played ? "opacity-60" : ""}>
                          {s.team_b}
                        </span>
                        {played && <span className="tabular-nums">{s.score_b}</span>}
                      </span>
                    </span>
                    <span className="hidden w-48 shrink-0 text-right text-xs text-muted sm:block">
                      BO{s.best_of} · {s.stage ?? s.tournament}
                      {s.round_label ? ` · ${s.round_label}` : ""}
                    </span>
                    <span
                      className={`w-20 shrink-0 text-right text-[11px] font-bold uppercase ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
