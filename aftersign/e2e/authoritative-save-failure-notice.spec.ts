import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 30_000;

async function tap(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await expect(control).toBeEnabled({ timeout: WAIT_MS });
  await control.tap();
}

async function boot(page: Page, slot: string, player: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${encodeURIComponent(slot)}&player=${player}`, {
    waitUntil: "load",
  });
  await expect(page.locator('[data-beat-id="packet-offered"]')).toBeVisible({ timeout: WAIT_MS });
}

test.describe("AFTERSIGN authoritative save failure notice", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a failed played save remains retryable and a later played save clears its polite notice", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}-${testInfo.workerIndex}`;
    const slot = `save-failure-${stamp}`;
    const player = `save-failure-player-${stamp}`;
    let failWrites = true;

    await page.route("**/aftersign/save/**", async (route) => {
      if (failWrites && route.request().method() === "PUT") {
        await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
        return;
      }
      await route.continue();
    });

    await boot(page, slot, player);
    await tap(page, "button[data-offered-job-id]");
    await tap(page, "#packetButton");
    await tap(page, 'button[data-choice-id="acknowledge-kiosk"]');
    await tap(page, 'button[data-choice-id="deliver-packet"]');

    const notice = page.locator("#saveFailureNotice");
    await expect(notice).toHaveAttribute("role", "status");
    await expect(notice).toHaveAttribute("aria-live", "polite");
    await expect(notice).toContainText("Save failed. Your progress will retry on the next save.");
    await expect(page.locator('[data-beat-id="packet-delivered"]')).toBeVisible();

    failWrites = false;
    await expect(page.locator('[data-beat-id="io-return-recognition"]')).toBeVisible({ timeout: WAIT_MS });
    await tap(page, 'button[data-return-reason="blunt"]');
    await expect(page.locator('[data-beat-id="return-tone-choice"]')).toBeVisible({ timeout: WAIT_MS });
    await tap(page, 'button[data-choice-id="ask-for-next-job"]');
    await expect(page.locator("#saveFailureNotice")).toHaveCount(0);
  });
});
