import { existsSync, renameSync, rmSync } from "node:fs";

// drizzle-kit pull menulis ke db/.pull. Ambil hanya tipe yang dihasilkan, buang sisanya.
for (const file of ["schema.ts", "relations.ts"]) {
  const from = `db/.pull/${file}`;
  if (existsSync(from)) renameSync(from, `db/${file}`);
}
rmSync("db/.pull", { recursive: true, force: true });
console.log("db/schema.ts diperbarui dari database.");
