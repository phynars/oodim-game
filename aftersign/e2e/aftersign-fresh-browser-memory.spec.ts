import { expect, test } from "@playwright/test";

const baseURL = process.env.AFTERSIGN_BASE_URL ?? "http://127.0.0.1:4173/aftersign/";

test.describe("AFTERSIGN fresh-browser memory", () => {
  test("a second browser context receives Io's server-backed packet recognition", async ({ browser }) => {
    const first = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const firstPage = await first.newPage();
    await firstPage.goto(baseURL);

    await expect(firstPage.getByText(/blue packet/i)).toBeVisible();
    await firstPage.getByRole("button", { name: /keep.*sealed|sealed/i }).click();
    await firstPage.getByRole("button", { name: /deliver/i }).click();
    await expect(firstPage.getByText(/unbroken/i)).toBeVisible();
    await first.close();

    const returning = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const returningPage = await returning.newPage();
    await returningPage.goto(baseURL);
    await expect(returningPage.getByText(/blue seal, unbroken/i)).toBeVisible();
    await returning.close();
  });
});
