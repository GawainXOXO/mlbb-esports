// Pengaman pemisahan uji LOKAL dan uji SERVER (CI).
// Uji hanya boleh menyentuh database yang namanya berakhiran `_test`, dan tidak pernah
// database produksi. Lokal: mlbb_test di kontainer Docker. CI: layanan postgres sementara milik CI.

export type TestEnv = "local" | "ci";

export function resolveTestDatabase(env: NodeJS.ProcessEnv = process.env): { url: string; testEnv: TestEnv } {
  const testEnv = env.TEST_ENV;
  if (testEnv !== "local" && testEnv !== "ci") {
    throw new Error("TEST_ENV harus 'local' atau 'ci'. Jalankan `pnpm test:local` atau `pnpm test:ci`.");
  }
  if (testEnv === "ci" && env.CI !== "true") {
    throw new Error("TEST_ENV=ci hanya untuk server CI. Di laptop pakai `docker compose run --rm test`.");
  }

  const raw = env.TEST_DATABASE_URL;
  if (!raw) throw new Error("TEST_DATABASE_URL belum diisi.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("TEST_DATABASE_URL bukan URL yang valid.");
  }
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Uji ditolak: database "${dbName}" bukan database uji (harus berakhiran _test).`);
  }
  const allowedHosts =
    testEnv === "local" ? ["db", "localhost", "127.0.0.1"] : ["localhost", "127.0.0.1", "postgres"];
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error(
      `Uji ditolak: host database uji ${testEnv} harus salah satu dari ${allowedHosts.join(", ")}.`,
    );
  }
  for (const key of ["DATABASE_URL", "DATABASE_URL_DIRECT"] as const) {
    if (env[key] && env[key] === raw) {
      throw new Error(`Uji ditolak: TEST_DATABASE_URL sama dengan ${key}.`);
    }
  }
  return { url: raw, testEnv };
}
