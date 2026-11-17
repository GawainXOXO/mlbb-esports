import "server-only";
import { Pool } from "pg";

// Satu pool per proses. max kecil supaya aman di Neon pooler (spesifikasi 2.5).
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool {
  if (!globalForDb.pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL belum diisi");
    globalForDb.pgPool = new Pool({ connectionString, max: 5 });
  }
  return globalForDb.pgPool;
}
