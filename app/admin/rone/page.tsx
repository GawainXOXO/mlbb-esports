import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { PullAllQueue } from "@/components/admin/PullAllQueue";
import { isAdmin } from "@/lib/admin";
import { getPool } from "@/lib/db";
import { manualPullEnabled } from "@/lib/ingest/pull";
import { LEAGUES } from "@/lib/sources/rone/client";
import { importFileAction, pullAction } from "./actions";

export const metadata: Metadata = { title: "Admin: data Rone", robots: { index: false } };
export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-sm bg-card shadow-sm">
      <h2 className="border-b border-line bg-card-alt px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="space-y-3 px-3 py-3">{children}</div>
    </section>
  );
}

const input = "rounded-sm border border-line bg-card px-2 py-1 text-[13px]";

function TournamentFields() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <label>
        Liga{" "}
        <select name="league" defaultValue={process.env.RONE_LEAGUE ?? "id"} className={input}>
          {Object.entries(LEAGUES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Slug turnamen{" "}
        <input
          name="tournament"
          defaultValue={process.env.RONE_TOURNAMENT_SLUG ?? "mpl-id-s18"}
          className={input}
        />
      </label>
      <label>
        Nama{" "}
        <input
          name="tournamentName"
          defaultValue={process.env.RONE_TOURNAMENT_NAME ?? "MPL ID Season 18"}
          className={input}
        />
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" name="createUnknownPlayers" defaultChecked /> Buat pemain baru bila belum
        dikenal (matikan setelah roster diisi)
      </label>
    </div>
  );
}

export default async function AdminRonePage() {
  if (!isAdmin()) notFound();
  const pool = getPool();
  const [pending, logs] = await Promise.all([
    pool.query<{ external_id: string; label: string; start_at: Date | null }>(
      `SELECT e.external_id, ta.name || ' vs ' || tb.name AS label, s.start_at
       FROM series s
       JOIN series_external_id e ON e.series_id = s.id
       JOIN data_source d ON d.id = e.source_id AND d.code = 'rone'
       JOIN team ta ON ta.id = s.team_a_id JOIN team tb ON tb.id = s.team_b_id
       WHERE s.status = 'finished' AND NOT EXISTS (SELECT 1 FROM game g WHERE g.series_id = s.id)
       ORDER BY s.start_at DESC LIMIT 200`,
    ),
    pool.query<{
      id: string;
      endpoint: string;
      status_code: number | null;
      fetched_at: Date;
      error: string | null;
    }>(
      `SELECT l.id, l.endpoint, l.status_code, l.fetched_at, l.error FROM ingest_log l
       ORDER BY l.id DESC LIMIT 10`,
    ),
  ]);
  const enabled = manualPullEnabled();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-3 text-lg font-extrabold">Data Rone Arena</h1>
      <div className="mb-4 rounded-sm border-l-4 border-accent bg-card px-3 py-2 text-xs leading-relaxed">
        <p>
          <b>Perhatian.</b> API Rone dibuat untuk developer, tetapi robots.txt Rone melarang akses otomatis ke{" "}
          <code>/api/</code>. Karena itu tarikan di sini hanya terjadi saat tombol ditekan: satu klik satu
          permintaan, jeda minimal 2 detik, dan endpoint yang sama dalam 5 menit memakai hasil tersimpan.
          Untuk pemakaian rutin, minta izin pengelola Rone dulu.
        </p>
        <p className="mt-1 text-muted">
          Tombol tarik: <b>{enabled ? "aktif" : "mati"}</b> (RONE_MANUAL_PULL). Tidak ada job terjadwal.
        </p>
      </div>

      <Section title="1. Tarik jadwal">
        <ActionForm action={pullAction} label="Tarik jadwal musim reguler">
          <input type="hidden" name="kind" value="schedule" />
          <TournamentFields />
        </ActionForm>
        <ActionForm action={pullAction} label="Tarik jadwal playoff">
          <input type="hidden" name="kind" value="playoffs" />
          <TournamentFields />
        </ActionForm>
      </Section>

      <Section title="2. Tarik detail match">
        <ActionForm action={pullAction} label="Tarik detail">
          <input type="hidden" name="kind" value="match" />
          <TournamentFields />
          <label className="block text-xs text-muted">
            ID match Rone <input name="matchId" required placeholder="1038" className={input} />
          </label>
        </ActionForm>
        {pending.rows.length > 0 && (
          <div className="space-y-2">
            {enabled && (
              <PullAllQueue matchIds={pending.rows.map((s) => s.external_id)} action={pullAction} />
            )}
            <p className="mb-1 text-xs text-muted">
              Seri selesai yang belum punya detail game ({pending.rows.length}):
            </p>
            <ul className="divide-y divide-line">
              {pending.rows.slice(0, 20).map((s) => (
                <li key={s.external_id} className="flex items-start justify-between gap-3 py-1.5">
                  <span>
                    {s.label} <span className="text-xs text-muted">#{s.external_id}</span>
                  </span>
                  <ActionForm action={pullAction} label="Tarik" compact>
                    <input type="hidden" name="kind" value="match" />
                    <input type="hidden" name="matchId" value={s.external_id} />
                    <input type="hidden" name="createUnknownPlayers" value="on" />
                  </ActionForm>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="3. Cadangan: impor berkas JSON">
        <p className="text-xs text-muted">
          Buka URL Rone di browser, simpan hasilnya sebagai berkas .json (Ctrl+S), lalu unggah di sini.
          Contoh: <code>https://arena.rone.dev/api/esports/id/schedule</code>, <code>.../id/playoffs</code>,{" "}
          <code>.../id/matches/1038</code>.
        </p>
        <ActionForm action={importFileAction} label="Impor berkas">
          <TournamentFields />
          <input type="file" name="files" accept="application/json,.json" multiple className="text-xs" />
        </ActionForm>
      </Section>

      <Section title="Riwayat terakhir">
        <ul className="divide-y divide-line text-xs">
          {logs.rows.map((l) => (
            <li key={l.id} className="py-1.5">
              <span className="tabular-nums text-muted">#{l.id}</span> <code>{l.endpoint}</code>{" "}
              <span className="text-muted">{l.status_code ?? "berkas"}</span>
              {l.error && <span className="block text-accent">{l.error}</span>}
            </li>
          ))}
          {logs.rows.length === 0 && <li className="py-1.5 text-muted">Belum ada.</li>}
        </ul>
      </Section>
    </div>
  );
}
