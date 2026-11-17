import type { Metadata } from "next";
import Link from "next/link";
import { SeriesList } from "@/components/SeriesList";
import { listResults } from "@/lib/db/matches";

export const metadata: Metadata = { title: "Hasil match" };
export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(raw) && raw > 0 && raw < 10_000 ? raw : 1;
  const { rows, hasMore } = await listResults(page);
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-sm font-bold">
        <Link href="/matches" className="text-muted hover:text-accent">
          Jadwal
        </Link>
        <span>Hasil</span>
      </div>
      <SeriesList series={rows} empty="Belum ada hasil match." />
      <nav className="mt-3 flex justify-between text-xs font-bold" aria-label="Halaman">
        {page > 1 ? <Link href={`/matches/results?page=${page - 1}`}>← Lebih baru</Link> : <span />}
        {hasMore && <Link href={`/matches/results?page=${page + 1}`}>Lebih lama →</Link>}
      </nav>
    </div>
  );
}
