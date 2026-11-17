// Fixture kecil berbentuk respons Rone (bentuk diambil dari uji sumber 17 Nov 2026).
// Tim dan pemain fiktif; tidak ada data atau gambar asli Rone di repo.

const HEROES_A = ["Freya", "Nolan", "Eudora", "Kaja", "Brody"];
const HEROES_B = ["Uranus", "Paquito", "Novaria", "Minotaur", "Melissa"];

function player(name: string, hero: string, i: number, heroImageId?: number) {
  return {
    name,
    hero: {
      name: hero,
      image: heroImageId ? `https://example.test/?url=x%2Fhero_h%2F${heroImageId}.png` : null,
    },
    kills: i,
    deaths: 1,
    assists: 2 + i,
    kda: 3,
    items: [{ id: "2009" }, { id: "2302" }, { id: String(3000 + i) }],
    emblem: { id: "20007" },
    talents: [{ id: "111" }, { id: "521" }],
    gold: 7000 + i * 100,
    damage_dealt: 30000 + i,
    damage_taken: 20000 + i,
    tower_damage: 1000 + i,
    item_sequence: [],
  };
}

export function scheduleFixture(overrides: { score1?: number; score2?: number } = {}) {
  return {
    weeks: [
      {
        week: 1,
        days: [
          {
            day: null,
            label: "Friday, 14 August 2026",
            matches: [
              {
                match_id: "9001",
                start_at: "2026-08-14T16:30:00+00:00",
                local_time: "23:30",
                team1: { name: "AAA", full_name: null, logo: null },
                team2: { name: "BBB", full_name: null, logo: null },
                score1: overrides.score1 ?? 2,
                score2: overrides.score2 ?? 0,
                replay_url: null,
                round: null,
                best_of: 3,
                status: "finished",
                winner: "team1",
              },
              {
                match_id: "9002",
                start_at: "2026-08-21T08:00:00+00:00",
                team1: null,
                team2: null,
                score1: null,
                score2: null,
                round: null,
                best_of: 3,
                status: "upcoming",
                winner: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function matchFixture(opts: { games?: number; playerPrefix?: string } = {}) {
  const prefix = opts.playerPrefix ?? "P";
  const games = Array.from({ length: opts.games ?? 2 }, (_, g) => ({
    number: g + 1,
    duration: g === 0 ? "10:51" : "12:36",
    duration_estimate: null,
    timeline_minutes: [],
    teams: [
      {
        team: { name: "AAA", full_name: null },
        winner: true,
        kills: 12,
        stats: {},
        players: HEROES_A.map((h, i) => player(`${prefix}A${i + 1}`, h, i, i === 0 ? 22 : undefined)),
      },
      {
        team: { name: "BBB", full_name: null },
        winner: false,
        kills: 3,
        stats: {},
        players: HEROES_B.map((h, i) => player(`${prefix}B${i + 1}`, h, i)),
      },
    ],
    highlights: [],
    screenshots: [],
  }));
  return { match_id: "9001", games };
}
