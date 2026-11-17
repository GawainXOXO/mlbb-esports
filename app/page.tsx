import Link from "next/link";
import { SeriesList } from "@/components/SeriesList";
import { getPool } from "@/lib/db";
import { listResults, listUpcoming } from "@/lib/db/matches";

export const dynamic = "force-dynamic";

async function loadSources(): Promise<string[] | null> {
  try {
    const { rows } = await getPool().query<{ attribution: string }>(
      "SELECT attribution FROM data_source WHERE attribution IS NOT NULL ORDER BY id",
    );
    return rows.map((r) => r.attribution);
  } catch (error) {
    // Detail galat (host, kredensial) hanya ke log server, tidak ke halaman.
    console.error("Database gagal dibaca:", error instanceof Error ? error.message : error);
    return null;
  }
}

function Card({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        {title}
        {href && (
          <Link href={href} className="normal-case hover:text-accent">
            Lihat semua →
          </Link>
        )}
      </h2>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const sources = await loadSources();
  if (sources === null) {
    return <p className="rounded-sm bg-card px-3 py-4 shadow-sm">Database belum tersambung.</p>;
  }
  const [upcoming, results] = await Promise.all([listUpcoming(6), listResults(1, 8)]);

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div>
        <Card title="Match mendatang" href="/matches">
          <SeriesList series={upcoming} empty="Belum ada match mendatang." />
        </Card>
        <Card title="Hasil terbaru" href="/matches/results">
          <SeriesList series={results.rows} empty="Belum ada hasil match." />
        </Card>
      </div>
      <aside>
        <Card title="Sumber data">
          <ul className="rounded-sm bg-card px-3 py-2 text-xs text-muted shadow-sm">
            {sources.map((s) => (
              <li key={s} className="py-1">
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
