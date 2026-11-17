import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameTabs } from "@/components/match/GameTabs";
import { getGames, getSeries } from "@/lib/db/matches";
import { wibDateLabel, wibTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; slug?: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const series = await getSeries((await params).id);
  if (!series) return { title: "Match tidak ditemukan" };
  return {
    title: `${series.team_a} vs ${series.team_b}`,
    description: `${series.team_a} vs ${series.team_b}, ${series.tournament}: draft, build, dan statistik per game.`,
    alternates: { canonical: `/match/${series.id}/${series.slug}` },
  };
}

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ game?: string }>;
}) {
  const series = await getSeries((await params).id);
  if (!series) notFound();
  const games = await getGames(series);
  const requested = Number((await searchParams).game);
  const initialGame = games.some((g) => g.game_no === requested) ? requested : 0;
  const decided = series.status === "finished";

  return (
    <div>
      <header className="mb-4 rounded-sm bg-card px-4 py-4 shadow-sm">
        <p className="text-center text-xs text-muted">
          {series.tournament}
          {series.stage ? ` · ${series.stage}` : ""}
          {series.round_label ? ` · ${series.round_label}` : ""}
        </p>
        <p className="text-center text-xs text-muted">
          {series.start_at
            ? `${wibDateLabel(series.start_at)}, ${wibTime(series.start_at)} WIB`
            : "Jadwal belum diketahui"}
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p
            className={`text-right text-lg font-extrabold ${decided && series.winner_team_id !== series.team_a_id ? "opacity-60" : ""}`}
          >
            {series.team_a}
          </p>
          <p className="text-center text-2xl font-extrabold tabular-nums">
            {decided || series.score_a + series.score_b > 0 ? `${series.score_a} : ${series.score_b}` : "vs"}
          </p>
          <p
            className={`text-lg font-extrabold ${decided && series.winner_team_id !== series.team_b_id ? "opacity-60" : ""}`}
          >
            {series.team_b}
          </p>
        </div>
        <p className="mt-1 text-center text-xs font-bold uppercase text-muted">BO{series.best_of}</p>
      </header>

      {games.length === 0 ? (
        <p className="rounded-sm bg-card px-3 py-4 text-muted shadow-sm">
          {series.status === "scheduled"
            ? "Match belum dimulai."
            : "Menunggu data, biasanya masuk setelah game selesai."}
        </p>
      ) : (
        <GameTabs games={games} initialGame={initialGame} />
      )}
    </div>
  );
}
