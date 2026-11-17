# MLBB Esports

Aggregator esports Mobile Legends: Bang Bang bergaya vlr.gg: jadwal, hasil, draft, dan statistik per game.
Dokumen produk dan teknis: `mlbb-prd.md`, `mlbb-spesifikasi-teknis.md`, `mlbb-schema-postgres-v2.sql`.

> Tidak berafiliasi dengan Moonton. Mobile Legends: Bang Bang adalah merek dagang Moonton.

## Menjalankan di laptop

Hanya butuh Docker Desktop.

```bash
docker compose up
```

Perintah itu menyalakan database (PostgreSQL 16, port host 5433), menjalankan migrasi dan seed, lalu web.
Buka <http://localhost:3000>. Hentikan dengan `Ctrl+C`, atau `docker compose down`.

Opsional: `cp .env.example .env` bila ingin mengubah nilai lokal. Tanpa `.env` pun proyek berjalan.

| Perintah                                      | Isi                                       |
| --------------------------------------------- | ----------------------------------------- |
| `docker compose up -d`                        | Jalan di latar belakang                   |
| `docker compose logs -f web`                  | Lihat log web                             |
| `docker compose run --rm test`                | Uji lokal (lihat di bawah)                |
| `docker compose run --rm test pnpm lint`      | Lint dan format (Biome)                   |
| `docker compose run --rm test pnpm typecheck` | Pemeriksaan tipe                          |
| `docker compose run --rm test pnpm db:pull`   | Perbarui `db/schema.ts` dari database     |
| `docker compose down -v`                      | Buang semua, termasuk data database lokal |

Setelah `package.json` berubah: `docker compose build` lalu `docker compose up -d -V`.

Melihat data dengan pgAdmin atau `psql`: sambung ke `localhost:5433`, database `mlbb`, pengguna `mlbb`.
PostgreSQL native di port 5432 tidak dipakai dan tidak disentuh proyek ini.

## Uji lokal dan uji server terpisah

|             | Uji lokal                                          | Uji server (CI)                                      |
| ----------- | -------------------------------------------------- | ---------------------------------------------------- |
| Perintah    | `docker compose run --rm test` (`pnpm test:local`) | `pnpm test:ci` di GitHub Actions                     |
| Database    | `mlbb_test` di kontainer laptop                    | Postgres sementara milik CI, dibuang setelah selesai |
| Konfigurasi | `compose.yaml`, `.env`                             | `.github/workflows/ci.yml`                           |

Pengaman di `tests/setup/test-db.ts` menolak menjalankan uji bila database bukan `*_test`, bila host bukan
database uji lokal atau CI, bila sama dengan `DATABASE_URL`, atau bila mode CI dijalankan di luar CI.
Uji tidak pernah menyentuh database `mlbb` lokal maupun produksi.

## Rahasia dan keamanan

1. `.env` dan semua `.env.*` tidak pernah masuk git maupun image Docker (`.gitignore`, `.dockerignore`).
   Hanya `.env.example` berisi nama variabel dan nilai contoh.
2. Rahasia produksi hanya di pengaturan Vercel dan GitHub Actions secrets.
3. Pemindai rahasia gitleaks berjalan sebelum commit (`.githooks/pre-commit`, aktifkan dengan
   `git config core.hooksPath .githooks`) dan di CI. Kredensial `mlbb:mlbb` hanya untuk database lokal
   dan CI yang sekali pakai.
4. Ikon, logo tim, dan aset Moonton tidak boleh masuk repo (`public/img` diabaikan git).

Checklist risiko endpoint dan kunci:

- [x] Endpoint publik (`/api/health`) hanya menjawab ok/gagal, tanpa host, versi, atau pesan galat.
- [x] Akses database hanya di server (`server-only`), kredensial tidak pernah ke browser.
- [x] Header keamanan: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS di produksi.
- [ ] `/admin` wajib login dan email di `admin_user` (M3). `DEV_ADMIN_BYPASS` ditolak di produksi.
- [ ] `POST /api/revalidate` dan endpoint job wajib rahasia di header, bukan di URL (M1).
- [ ] Batas laju untuk endpoint publik yang menulis atau mahal (M1, sebelum rilis).
- [ ] Hanya nilai yang memang publik memakai awalan `NEXT_PUBLIC_`. Kunci API dan URL berisi token tidak.
- [ ] Secret scanning dan push protection aktif di pengaturan repo GitHub.

## Struktur

```
app/            halaman (Next.js App Router)
db/migrations/  migrasi SQL, 0000_init.sql = skema v2
db/schema.ts    tipe Drizzle, dihasilkan dari database
lib/db/         koneksi dan migrasi
scripts/        migrate, seed, ingest
tests/          unit, integration, e2e
```

## Status

- M0 Fondasi: berjalan lokal lewat Docker, skema v2 termigrasi, CI disiapkan. Deploy ke internet menyusul.
- M1: penarikan data otomatis dari Rone Arena.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS 4, PostgreSQL 16, Drizzle, Vitest,
Playwright, Biome, Docker Compose, GitHub Actions.

## Sumber data

Data via Rone Arena API. Data dari Liquipedia, lisensi CC-BY-SA 3.0. Data game milik Moonton.

## Lisensi

Kode berlisensi MIT (lihat `LICENSE`). Lisensi tidak mencakup data game, nama, ikon, atau logo.
