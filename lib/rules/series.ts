// DR-03: skor seri dihitung dari pemenang game, dan status selesai ditentukan dari skor itu.

export type GameResult = { winner: "a" | "b" | null };

export function winsNeeded(bestOf: number): number {
  return bestOf === 2 ? 2 : Math.ceil(bestOf / 2);
}

export function scoreFromGames(games: GameResult[]): { a: number; b: number } {
  return games.reduce(
    (score, g) => ({ a: score.a + (g.winner === "a" ? 1 : 0), b: score.b + (g.winner === "b" ? 1 : 0) }),
    { a: 0, b: 0 },
  );
}

/** Seri selesai bila satu tim mencapai kemenangan yang dibutuhkan, atau BO2 sudah dua game. */
export function isSeriesDecided(bestOf: number, score: { a: number; b: number }): boolean {
  if (bestOf === 2) return score.a + score.b === 2;
  const need = winsNeeded(bestOf);
  return score.a >= need || score.b >= need;
}
