import { expect, test, type Page } from "@playwright/test";

const WAIT = 15_000;

test.describe("Return to Io manual advance (#3147)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("stays at delivery for three seconds, then advances only after a visible tap", async ({ page }) => {
    test.setTimeout(45_000);
    const id = Date.now();
    await page.goto(`/aftersign/?slot=return-to-io-${id}&player=e2e-${id}`, { waitUntil: "load" });

    await tap(page, '#job-offer-job-safe-delivery');
    await tap(page, "#packetButton");
    await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
    await tap(page, 'button[data-choice-id="deliver-packet"]');

    const returnToIo = page.getByRole("button", { name: "Return to Io" });
    await expect(returnToIo).toBeVisible({ timeout: WAIT });
    await page.waitForTimeout(3_000);
    await expect(returnToIo).toBeVisible();
    await expect(page.locator('button[data-return-reason]')).toHaveCount(0);

    await returnToIo.tap({ timeout: WAIT });
    await expect(page.locator('button[data-return-reason]')).toHaveCount(3, { timeout: WAIT });
    await expect(page.getByRole("button", { name: "Kind return" })).toBeVisible();
  });
});

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeVisible({ timeout: WAIT });
  await expect(control).toBeInViewport({ ratio: 1 });
  await control.tap({ timeout: WAIT });
}
