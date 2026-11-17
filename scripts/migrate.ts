import { runMigrations } from "../lib/db/migrate";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diisi");
  process.exit(1);
}

await runMigrations(url);
console.log("Migrasi selesai.");
