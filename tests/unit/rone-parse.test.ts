import { describe, expect, it } from "vitest";
import { isSeriesDecided, scoreFromGames } from "../../lib/rules/series";
import { heroIdFromImage, mapStatus, parseDuration, teamSlug } from "../../lib/sources/rone/parse";
import { RoneMatchDetail, RoneSchedule } from "../../lib/sources/rone/schemas";
import { compactNumber, wibDateKey } from "../../lib/time";
import { matchFixture, scheduleFixture } from "../fixtures/rone/build";

describe("parser Rone", () => {
  it("durasi mm:ss dan h:mm:ss ke detik, nilai rusak menjadi null (DR-18)", () => {
    expect(parseDuration("10:51")).toBe(651);
    expect(parseDuration("1:02:03")).toBe(3723);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("0:00")).toBeNull();
  });

  it("status dipetakan, status asing adalah galat", () => {
    expect(mapStatus("finished")).toBe("finished");
    expect(mapStatus("Upcoming")).toBe("scheduled");
    expect(() => mapStatus("weird")).toThrow(/tidak dikenal/);
  });

  it("ID hero diambil dari gambar bila ada", () => {
    expect(heroIdFromImage("https://wsrv.nl/?url=https%3A%2F%2Fx.com%2Fhero_h%2F22.png")).toBe(22);
    expect(heroIdFromImage("https://wsrv.nl/?url=https%3A%2F%2Fx.com%2Fm%2F33%2Fp.png")).toBeNull();
  });

  it("slug tim mengikuti kode Rone", () => {
    expect(teamSlug("RRQ")).toBe("rrq");
    expect(teamSlug("Team Liquid ID")).toBe("team-liquid-id");
  });

  it("fixture lolos skema", () => {
    expect(RoneSchedule.safeParse(scheduleFixture()).success).toBe(true);
    expect(RoneMatchDetail.safeParse(matchFixture()).success).toBe(true);
  });

  it("skema menolak pemain tanpa nama hero", () => {
    const bad = matchFixture();
    (bad.games[0].teams[0].players[0].hero as { name: string }).name = "";
    expect(RoneMatchDetail.safeParse(bad).success).toBe(false);
  });
});

describe("DR-03 skor seri", () => {
  it("menghitung skor dan menentukan selesai", () => {
    const score = scoreFromGames([{ winner: "a" }, { winner: "b" }, { winner: "a" }]);
    expect(score).toEqual({ a: 2, b: 1 });
    expect(isSeriesDecided(3, score)).toBe(true);
    expect(isSeriesDecided(5, score)).toBe(false);
    expect(isSeriesDecided(2, { a: 1, b: 1 })).toBe(true);
  });
});

describe("tampilan", () => {
  it("seri 23.30 WIB masuk tanggal WIB, bukan UTC (FR-01)", () => {
    expect(wibDateKey(new Date("2026-08-14T16:30:00Z"))).toBe("2026-08-14");
    expect(wibDateKey(new Date("2026-08-14T17:30:00Z"))).toBe("2026-08-15");
  });

  it("angka besar disingkat", () => {
    expect(compactNumber(14200)).toBe("14,2k");
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(null)).toBeNull();
  });
});
