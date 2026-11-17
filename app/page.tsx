import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type Status =
  | { ok: true; tables: number; migrations: number; sources: { code: string; attribution: string | null }[] }
  | { ok: false };

async function loadStatus(): Promise<Status> {
  try {
    const pool = getPool();
    const [tables, migrations, sources] = await Promise.all([
      pool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      ),
      pool.query<{ n: number }>("SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations"),
      pool.query<{ code: string; attribution: string | null }>(
        "SELECT code, attribution FROM data_source ORDER BY id",
      ),
    ]);
    return { ok: true, tables: tables.rows[0].n, migrations: migrations.rows[0].n, sources: sources.rows };
  } catch (error) {
    // Detail galat (host, kredensial) hanya ke log server, tidak ke halaman.
    console.error("Status database gagal dibaca:", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 overflow-hidden rounded-sm bg-card shadow-sm">
      <h2 className="border-b border-line bg-card-alt px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

const PREVIEW = [
  { time: "17:00", a: "TBD", b: "TBD", bo: "BO3", event: "MPL ID" },
  { time: "19:00", a: "TBD", b: "TBD", bo: "BO3", event: "MPL ID" },
];

export default async function HomePage() {
  const status = await loadStatus();

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <div>
        <Card title="Match mendatang">
          <ul>
            {PREVIEW.map((m) => (
              <li
                key={m.time}
                className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-card-alt"
              >
                <span className="w-12 font-semibold tabular-nums text-muted">{m.time}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{m.a}</span>
                  <span className="block font-semibold">{m.b}</span>
                </span>
                <span className="text-xs text-muted">
                  {m.bo} · {m.event}
                </span>
                <span className="rounded-sm bg-card-alt px-2 py-0.5 text-[11px] font-bold uppercase text-muted">
                  Contoh
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-3 text-muted">
            Belum ada data asli. Jadwal dan hasil mulai masuk setelah tahap M1 (penarikan data otomatis).
          </p>
        </Card>
      </div>

      <aside>
        <Card title="Status sistem">
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 px-3 py-3">
            <dt className="text-muted">Database</dt>
            <dd className={`font-bold ${status.ok ? "text-green-600" : "text-accent"}`}>
              {status.ok ? "Tersambung" : "Tidak tersambung"}
            </dd>
            {status.ok && (
              <>
                <dt className="text-muted">Tabel skema</dt>
                <dd className="font-semibold tabular-nums">{status.tables}</dd>
                <dt className="text-muted">Migrasi terpasang</dt>
                <dd className="font-semibold tabular-nums">{status.migrations}</dd>
              </>
            )}
          </dl>
        </Card>
        {status.ok && (
          <Card title="Sumber data">
            <ul className="px-3 py-2 text-xs text-muted">
              {status.sources
                .filter((s) => s.attribution)
                .map((s) => (
                  <li key={s.code} className="py-1">
                    {s.attribution}
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </aside>
    </div>
  );
}
