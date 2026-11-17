import { expect, test } from "@playwright/test";

test("beranda tampil dan database tersambung", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Match mendatang" })).toBeVisible();
  await expect(page.getByText("Tersambung", { exact: true })).toBeVisible();
});
