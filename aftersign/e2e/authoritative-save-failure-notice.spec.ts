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
  // Each test plays the full delivery plus the delayed recognition beat;
  // against the served Worker that exceeds the 30s default.
  test.beforeEach(() => {
    test.setTimeout(120_000);
  });

  test("a failed authoritative read keeps the played state and retry loads the recovered snapshot", async ({ page }, testInfo) => {
    const stamp = `${Date.now()}-${testInfo.workerIndex}`;
    const slot = `load-failure-${stamp}`;
    const player = `load-failure-player-${stamp}`;
    let failReads = false;

    await page.route("**/aftersign/save/**", async (route) => {
      if (failReads && route.request().method() === "GET") {
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
    await expect(page.locator('[data-beat-id="packet-delivered"]')).toBeVisible();
    // Let the delayed recognition beat land before the read fails. A restore
    // never reopens on `packet-delivered`: `restoreFlagshipBeat` (#2747)
    // promotes a delivered save to `io-return-recognition`, so that is the
    // beat both the kept state and the recovered snapshot render.
    const recognition = page.locator('[data-beat-id="io-return-recognition"]');
    await expect(recognition).toBeVisible({ timeout: WAIT_MS });
    await page.evaluate(async () => window.__game!.input.forceSave());

    failReads = true;
    await page.evaluate(async () => window.__game!.input.forceReload());

    const notice = page.locator("#loadFailureNotice");
    await expect(notice).toHaveAttribute("role", "alert");
    await expect(notice).toContainText("Unable to load saved progress");
    await expect(recognition).toBeVisible();

    failReads = false;
    const retryRead = page.waitForResponse(
      (response) => response.url().includes("/aftersign/save/") && response.request().method() === "GET",
      { timeout: WAIT_MS },
    );
    await tap(page, "#retryLoadSave");
    expect((await retryRead).ok()).toBe(true);
    await expect(notice).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.__game!.save.lastLoadProof?.source ?? null), { timeout: WAIT_MS })
      .toBe("server");
    await expect(recognition).toBeVisible();
  });

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
