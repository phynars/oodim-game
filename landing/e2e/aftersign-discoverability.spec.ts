import { test, expect } from "@playwright/test";

test.describe("landing page discoverability", () => {
  test("shows an AFTERSIGN card that links to /aftersign/", async ({ page }) => {
    await page.goto("/");

    const card = page.getByRole("link", { name: /aftersign/i });
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("href", "./aftersign/");

    await expect(page.getByRole("heading", { name: "AFTERSIGN" })).toBeVisible();
    await expect(page.getByText(/in development/i).first()).toBeVisible();
  });
});
