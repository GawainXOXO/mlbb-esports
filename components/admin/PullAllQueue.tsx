"use client";

import { useRef, useState } from "react";
import type { ActionState } from "@/app/admin/rone/actions";

const MAX_PER_CLICK = 15;
const GAP_MS = 2500;

type Props = {
  matchIds: string[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
};

/**
 * "Tarik semua": antrean berurutan yang dimulai satu klik, paling banyak 15 match, jeda 2,5 detik,
 * berhenti pada galat pertama, dan bisa dibatalkan. Tidak berlanjut di latar belakang.
 */
export function PullAllQueue({ matchIds, action }: Props) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ id: string; ok: boolean; message: string }[]>([]);
  const cancelled = useRef(false);
  const batch = matchIds.slice(0, MAX_PER_CLICK);

  async function start() {
    cancelled.current = false;
    setRunning(true);
    setLog([]);
    for (const [index, id] of batch.entries()) {
      if (cancelled.current) break;
      if (index > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      if (cancelled.current) break;
      const form = new FormData();
      form.set("kind", "match");
      form.set("matchId", id);
      form.set("createUnknownPlayers", "on");
      const result = await action(null, form);
      const entry = { id, ok: Boolean(result?.ok), message: result?.message ?? "tidak ada jawaban" };
      setLog((l) => [...l, entry]);
      if (!entry.ok) break;
    }
    setRunning(false);
  }

  if (matchIds.length === 0) return null;
  const done = log.length;

  return (
    <div className="space-y-2 rounded-sm border border-line px-3 py-2">
      <p className="text-xs text-muted">
        Menarik {batch.length} dari {matchIds.length} match yang belum punya detail, satu per satu dengan jeda{" "}
        {GAP_MS / 1000} detik. Berhenti otomatis bila ada galat. Tarikan massal lebih jauh dari maksud
        robots.txt Rone, jadi pakai seperlunya.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={start}
          disabled={running}
          className="rounded-sm bg-accent px-3 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-50"
        >
          {running ? `Menarik ${done + 1}/${batch.length}...` : `Tarik semua (${batch.length})`}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              cancelled.current = true;
            }}
            className="rounded-sm border border-line px-3 py-1.5 text-xs font-bold uppercase"
          >
            Batalkan
          </button>
        )}
      </div>
      {log.length > 0 && (
        <ul className="space-y-0.5 text-xs" role="status">
          {log.map((l) => (
            <li key={l.id} className={l.ok ? "text-green-600" : "text-accent"}>
              {l.message}
            </li>
          ))}
          {!running && (
            <li className="text-muted">
              Selesai: {log.filter((l) => l.ok).length} berhasil. Muat ulang halaman untuk melihat sisa
              antrean.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
