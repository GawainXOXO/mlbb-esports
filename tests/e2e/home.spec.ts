import { expect, test } from "@playwright/test";

test("beranda tampil dengan jadwal dan hasil", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Match mendatang/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hasil terbaru/ })).toBeVisible();
});
