import { expect, test, type Page } from "@playwright/test";

// Failing-first contract for #2260/#2264. The red-tag outcome is a durable,
// server-owned choice: a new browser context for the same slot must render the
// same Saint Orra route without relying on localStorage.

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 15_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(
    `button[data-choice-id="${choiceId}"]:not([disabled])`,
  );
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function reachRedTag(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await page.locator('#offeredJobs button[data-offered-job-id="job-safe-delivery"]').tap();
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN Saint Orra durable red-tag route (#2264)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  // Gated until #2264 lands the Saint Orra red-tag surface in aftersign/src.
  // Today the page renders neither the `open-red-tag` choice nor the
  // `data-saint-orra-route` buttons this spec asserts on, so a live run would
  // red the aftersign e2e job at the first tap. Flipping to `test.fixme`
  // keeps the contract version-controlled and visible, and the #2264 PR will
  // promote it back to `test` the moment the surface exists.
  test.fixme("an opened red tag keeps Saint Orra's closed route after a new-browser reload", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const slot = `saint-orra-durable-route-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForReady(page);
    await reachRedTag(page);

    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "open-red-tag");
    await tapChoice(page, "deliver-packet");

    // #2264 owns these stable, mutually exclusive action ids. They are the
    // player-facing proof that Saint Orra paid the red-tag memory back.
    const closedRoute = page.locator(
      'button[data-saint-orra-route="closed"]:not([disabled])',
    );
    const openRoute = page.locator(
      'button[data-saint-orra-route="open"]:not([disabled])',
    );
    await expect(closedRoute).toBeVisible({ timeout: WAIT_MS });
    await expect(openRoute).toHaveCount(0);

    // A new context removes all browser storage. Reusing only the slot makes
    // this a server-state assertion rather than a localStorage replay.
    const returningContext = await browser.newContext({
      viewport: PHONE_VIEWPORT,
      hasTouch: true,
      isMobile: true,
    });
    const returningPage = await returningContext.newPage();
    try {
      await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await waitForReady(returningPage);
      await expect(
        returningPage.locator(
          'button[data-saint-orra-route="closed"]:not([disabled])',
        ),
      ).toBeVisible({ timeout: WAIT_MS });
      await expect(
        returningPage.locator(
          'button[data-saint-orra-route="open"]:not([disabled])',
        ),
      ).toHaveCount(0);
    } finally {
      await returningContext.close();
    }
  });
});
