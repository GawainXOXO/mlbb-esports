import { describe, expect, it } from "vitest";
import { resolveTestDatabase } from "../setup/test-db";

const local = (url: string, extra: Record<string, string> = {}) =>
  resolveTestDatabase({
    TEST_ENV: "local",
    TEST_DATABASE_URL: url,
    ...extra,
  } as unknown as NodeJS.ProcessEnv);

describe("pemisahan database uji", () => {
  it("menerima mlbb_test lokal", () => {
    expect(local("postgres://u:p@db:5432/mlbb_test").testEnv).toBe("local");
  });

  it("menolak database bukan _test", () => {
    expect(() => local("postgres://u:p@db:5432/mlbb")).toThrow(/bukan database uji/);
  });

  it("menolak host luar seperti Neon", () => {
    expect(() => local("postgres://u:p@ep-x.neon.tech/mlbb_test")).toThrow(/host database uji/);
  });

  it("menolak bila sama dengan DATABASE_URL", () => {
    const url = "postgres://u:p@db:5432/mlbb_test";
    expect(() => local(url, { DATABASE_URL: url })).toThrow(/sama dengan DATABASE_URL/);
  });

  it("menolak mode ci di luar server CI", () => {
    expect(() =>
      resolveTestDatabase({
        TEST_ENV: "ci",
        TEST_DATABASE_URL: "postgres://u:p@localhost:5432/mlbb_test",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/hanya untuk server CI/);
  });
});
