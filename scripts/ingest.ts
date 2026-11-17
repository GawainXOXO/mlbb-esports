// Job penarikan data (spesifikasi bagian 7). Isinya dikerjakan di M1 setelah uji sumber 4.5.
const JOBS = ["sync-schedule", "sync-games", "sync-standings", "sync-master"] as const;

const job = process.argv[2];
if (!job || !JOBS.includes(job as (typeof JOBS)[number])) {
  console.error(`Pemakaian: pnpm ingest <job>. Job yang dikenal: ${JOBS.join(", ")}`);
  process.exit(1);
}
console.error(`Job "${job}" belum diimplementasikan (dijadwalkan di M1).`);
process.exit(1);
