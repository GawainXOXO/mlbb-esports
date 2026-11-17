import { defineConfig } from "drizzle-kit";

// Sumber kebenaran skema adalah migrasi SQL di db/migrations (spesifikasi 2.5).
export default defineConfig({
  dialect: "postgresql",
  out: "./db/migrations",
  schema: "./db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "" },
  schemaFilter: ["public"],
  migrations: { table: "__drizzle_migrations", schema: "drizzle" },
});
