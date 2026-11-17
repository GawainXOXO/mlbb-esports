"use client";

import { useMemo, useState } from "react";
import type { GameDetail, PlayerLine, TeamSide } from "@/lib/db/matches";
import { compactNumber, formatDuration } from "@/lib/time";

const BADGE = {
  lengkap: { label: "Lengkap", cls: "bg-green-600 text-white" },
  sebagian: { label: "Sebagian", cls: "bg-amber-500 text-white" },
  menunggu: { label: "Menunggu", cls: "bg-card-alt text-muted" },
} as const;

const ORIGIN_LABEL: Record<string, string> = {
  stage_default: "bawaan tahap",
  tournament_default: "bawaan turnamen",
  guessed_by_date: "tebakan dari tanggal",
};

function Badge({ game }: { game: GameDetail }) {
  const b = BADGE[game.completeness];
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${b.cls}`}
      title={game.missing.length ? `Belum ada: ${game.missing.join(", ")}` : undefined}
    >
      {b.label}
    </span>
  );
}

function Empty() {
  return (
    <span className="text-muted" title="belum tersedia">
      –
    </span>
  );
}

type Col = { key: keyof PlayerLine | "kda"; label: string; num?: boolean };
const COLS: Col[] = [
  { key: "kills", label: "K", num: true },
  { key: "deaths", label: "D", num: true },
  { key: "assists", label: "A", num: true },
  { key: "gold", label: "Gold", num: true },
  { key: "damage_dealt", label: "Damage", num: true },
  { key: "tower_damage", label: "Turret", num: true },
  { key: "damage_taken", label: "Taken", num: true },
  { key: "participation_pct", label: "WP", num: true },
];

function value(p: PlayerLine, key: Col["key"]): number | null {
  if (key === "kda") return null;
  const v = p[key];
  return v == null ? null : Number(v);
}

function StatsTable({ side, maxima }: { side: TeamSide; maxima: Map<string, number> }) {
  const [sort, setSort] = useState<{ key: Col["key"]; desc: boolean } | null>(null);
  const players = useMemo(() => {
    if (!sort) return side.players;
    return [...side.players].sort((a, b) => {
      const av = value(a, sort.key) ?? -Infinity;
      const bv = value(b, sort.key) ?? -Infinity;
      return sort.desc ? bv - av : av - bv;
    });
  }, [side.players, sort]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12px]">
        <caption className="sr-only">Statistik pemain {side.team}</caption>
        <thead>
          <tr className="bg-card-alt text-[11px] uppercase text-muted">
            <th className="px-2 py-1.5 text-left">
              {side.team}{" "}
              <span className="font-normal normal-case">
                · {side.kills ?? "–"} kill · gold {compactNumber(side.total_gold) ?? "–"}
                {side.gold_rows < 5 && side.players.length > 0 ? " (tidak lengkap)" : ""}
              </span>
            </th>
            <th className="px-2 py-1.5 text-left">Hero</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-1.5 py-1.5 text-right">
                <button
                  type="button"
                  className="uppercase hover:text-accent"
                  onClick={() => setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : true }))}
                >
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.player_id} className="border-t border-line align-top">
              <td className="px-2 py-1.5">
                <span className="font-semibold">{p.player}</span>
                {p.is_mvp && <span className="ml-1 text-[10px] font-bold text-amber-500">MVP</span>}
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {p.items.map((i) => (
                    <span
                      key={i.slot}
                      className="rounded-sm bg-card-alt px-1 text-[10px] text-muted"
                      title={i.name}
                    >
                      {i.name}
                    </span>
                  ))}
                  {p.emblem && (
                    <span className="rounded-sm border border-line px-1 text-[10px] text-muted">
                      {p.emblem}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-2 py-1.5">
                {p.hero}
                {p.hero_provisional && (
                  <span className="ml-1 text-[10px] text-muted" title="ID hero belum dipastikan">
                    (sementara)
                  </span>
                )}
              </td>
              {COLS.map((c) => {
                const v = value(p, c.key);
                const top = v != null && maxima.get(c.key) === v && c.key !== "deaths";
                const shown =
                  c.key === "participation_pct"
                    ? v == null
                      ? null
                      : `${v}%${p.participation_origin === "estimated" ? " est." : ""}`
                    : ["gold", "damage_dealt", "damage_taken", "tower_damage"].includes(c.key)
                      ? compactNumber(v)
                      : v;
                return (
                  <td
                    key={c.key}
                    className={`px-1.5 py-1.5 text-right tabular-nums ${top ? "font-extrabold text-accent" : ""}`}
                    title={v != null ? v.toLocaleString("id-ID") : "belum tersedia"}
                  >
                    {shown ?? <Empty />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameView({ game }: { game: GameDetail }) {
  const maxima = useMemo(() => {
    const m = new Map<string, number>();
    const all = game.sides.flatMap((s) => s.players);
    for (const c of COLS) {
      const vals = all.map((p) => value(p, c.key)).filter((v): v is number => v != null);
      if (vals.length) m.set(c.key, Math.max(...vals));
    }
    return m;
  }, [game]);
  const winner = game.sides.find((s) => s.team_id === game.winner_team_id);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm bg-card px-3 py-2 text-xs shadow-sm">
        <b className="text-sm">Game {game.game_no}</b>
        <span>Pemenang: {winner?.team ?? <Empty />}</span>
        <span>Durasi: {formatDuration(game.duration_sec) ?? <Empty />}</span>
        <span>
          {game.patch ? (
            <>
              Patch {game.patch}
              {game.patch_origin && ORIGIN_LABEL[game.patch_origin] && (
                <span className="ml-1 text-muted">(perkiraan: {ORIGIN_LABEL[game.patch_origin]})</span>
              )}
            </>
          ) : (
            <span className="text-muted">Patch belum dipastikan</span>
          )}
        </span>
        <span>{game.battlefield ?? <span className="text-muted">Battlefield belum diisi</span>}</span>
        <Badge game={game} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {game.sides.map((side) => (
          <div key={side.team_id} className="rounded-sm bg-card px-3 py-2 text-xs shadow-sm">
            <p className="mb-1 font-bold">{side.team}</p>
            <p className="text-muted">Ban belum diisi</p>
            <p className="mt-1">
              <span className="text-muted">Pick: </span>
              {side.players.map((p) => `${p.hero} (${p.player})`).join(", ") || <Empty />}
            </p>
          </div>
        ))}
      </div>

      {game.sides.map((side) => (
        <section key={side.team_id} className="overflow-hidden rounded-sm bg-card shadow-sm">
          <StatsTable side={side} maxima={maxima} />
        </section>
      ))}
    </div>
  );
}

export function GameTabs({ games, initialGame }: { games: GameDetail[]; initialGame: number }) {
  const [active, setActive] = useState(initialGame);
  const select = (n: number) => {
    setActive(n);
    const url = new URL(window.location.href);
    if (n === 0) url.searchParams.delete("game");
    else url.searchParams.set("game", String(n));
    window.history.replaceState(null, "", url);
  };

  return (
    <div>
      <div role="tablist" className="mb-3 flex flex-wrap gap-1">
        {[
          { n: 0, label: "Ringkasan" },
          ...games.map((g) => ({ n: g.game_no, label: `Game ${g.game_no}` })),
        ].map((t) => (
          <button
            key={t.n}
            type="button"
            role="tab"
            aria-selected={active === t.n}
            onClick={() => select(t.n)}
            className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase ${
              active === t.n ? "bg-accent text-white" : "bg-card text-muted shadow-sm hover:text-accent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" hidden={active !== 0}>
        <ul className="overflow-hidden rounded-sm bg-card shadow-sm">
          {games.map((g) => {
            const winner = g.sides.find((s) => s.team_id === g.winner_team_id);
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => select(g.game_no)}
                  className="font-bold hover:text-accent"
                >
                  Game {g.game_no}
                </button>
                <span className="flex-1">{winner ? `${winner.team} menang` : <Empty />}</span>
                <span className="tabular-nums text-muted">{formatDuration(g.duration_sec) ?? "–"}</span>
                <Badge game={g} />
              </li>
            );
          })}
        </ul>
      </div>
      {games.map((g) => (
        <div key={g.id} role="tabpanel" hidden={active !== g.game_no}>
          <GameView game={g} />
        </div>
      ))}
    </div>
  );
}
