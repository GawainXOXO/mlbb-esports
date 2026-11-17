import { z } from "zod";

// Bentuk respons Rone Arena yang benar-benar teramati (uji sumber 17 Nov 2026, spesifikasi 4.5).
// Field yang tidak dipakai dibuang oleh z.object. Field yang bisa kosong ditandai nullish.

const nullableInt = z.number().int().nullish();
const nullableNum = z.number().nullish();

export const RoneTeamRef = z.object({
  name: z.string().min(1),
  full_name: z.string().nullish(),
});

export const RoneScheduleMatch = z.object({
  match_id: z.string().min(1),
  start_at: z.string().nullish(),
  team1: RoneTeamRef.nullish(),
  team2: RoneTeamRef.nullish(),
  score1: nullableInt,
  score2: nullableInt,
  replay_url: z.string().nullish(),
  round: z.string().nullish(),
  best_of: z.number().int(),
  status: z.string(),
  winner: z.enum(["team1", "team2"]).nullish(),
});
export type RoneScheduleMatch = z.infer<typeof RoneScheduleMatch>;

const RoneDay = z.object({
  label: z.string().nullish(),
  matches: z.array(RoneScheduleMatch),
});

export const RoneSchedule = z.object({
  weeks: z.array(z.object({ week: z.number().int().nullish(), days: z.array(RoneDay) })),
});

export const RonePlayoffs = z.object({
  days: z.array(RoneDay),
});

const RoneIdRef = z.object({ id: z.string().min(1) });

export const RonePlayer = z.object({
  name: z.string().min(1),
  hero: z.object({ name: z.string().min(1), image: z.string().nullish() }),
  kills: nullableInt,
  deaths: nullableInt,
  assists: nullableInt,
  items: z.array(RoneIdRef).default([]),
  emblem: RoneIdRef.nullish(),
  talents: z.array(RoneIdRef).default([]),
  gold: nullableNum,
  damage_dealt: nullableNum,
  damage_taken: nullableNum,
  tower_damage: nullableNum,
});
export type RonePlayer = z.infer<typeof RonePlayer>;

export const RoneGame = z.object({
  number: z.number().int().min(1),
  duration: z.string().nullish(),
  teams: z.array(
    z.object({
      team: RoneTeamRef,
      winner: z.boolean().nullish(),
      kills: nullableInt,
      players: z.array(RonePlayer),
    }),
  ),
});
export type RoneGame = z.infer<typeof RoneGame>;

export const RoneMatchDetail = z.object({
  match_id: z.string().min(1),
  games: z.array(RoneGame),
});
export type RoneMatchDetail = z.infer<typeof RoneMatchDetail>;
