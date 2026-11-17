import { defineConfig, devices } from "@playwright/test";

// E2E belum dijalankan di CI pada M0; browser dipasang lewat image resmi Playwright (spesifikasi 2.7).
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000" },
  projects: [{ name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } }],
});
