import { defineConfig } from "drizzle-kit";

// Hanya untuk `pnpm db:pull`: hasil introspeksi ditulis ke db/.pull lalu
// scripts/move-pulled-schema.ts memindahkan schema.ts dan relations.ts ke db/.
export default defineConfig({
  dialect: "postgresql",
  out: "./db/.pull",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "" },
  schemaFilter: ["public"],
});
