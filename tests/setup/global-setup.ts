import { Pool } from "pg";
import { runMigrations } from "../../lib/db/migrate";
import { resolveTestDatabase } from "./test-db";

// Membangun ulang database uji dari nol setiap putaran: buang skema, lalu migrasi.
// Aman karena resolveTestDatabase hanya menerima database *_test.
export default async function setup() {
  const { url, testEnv } = resolveTestDatabase();
  console.log(`[uji ${testEnv}] memakai database uji ${new URL(url).pathname.slice(1)}`);

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(
      "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
    );
  } finally {
    await pool.end();
  }
  await runMigrations(url);
}
