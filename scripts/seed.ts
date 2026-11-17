import { Pool } from "pg";

// Master data awal. Idempoten: aman dijalankan berkali-kali.
// Hero, item, emblem, talent dari Rone diisi di M1 setelah uji sumber (spesifikasi 4.5).
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL belum diisi");
  process.exit(1);
}

const pool = new Pool({ connectionString: url, max: 1 });
try {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  if (email) {
    await pool.query("INSERT INTO admin_user (email) VALUES ($1) ON CONFLICT (email) DO NOTHING", [email]);
    console.log("Seed: admin awal dipastikan ada.");
  } else {
    console.log("Seed: ADMIN_BOOTSTRAP_EMAIL kosong, admin awal dilewati.");
  }
} finally {
  await pool.end();
}
