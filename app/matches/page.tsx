import type { Metadata } from "next";
import Link from "next/link";
import { SeriesList } from "@/components/SeriesList";
import { listUpcoming } from "@/lib/db/matches";

export const metadata: Metadata = { title: "Jadwal match" };
export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const series = await listUpcoming();
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm font-bold">
        <span>Jadwal</span>
        <Link href="/matches/results" className="text-muted hover:text-accent">
          Hasil
        </Link>
      </div>
      <SeriesList series={series} empty="Belum ada match mendatang." />
    </div>
  );
}
