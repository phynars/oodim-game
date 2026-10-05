import { expect, test, type Page } from "@playwright/test";

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
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`);
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function expectFullyInsidePhone(page: Page, selector: string): Promise<void> {
  const rect = await page.locator(selector).evaluate((element) => {
    const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
    return { left, top, right, bottom, width, height };
  });
  expect(rect.width).toBeGreaterThan(0);
  expect(rect.height).toBeGreaterThan(0);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThanOrEqual(0);
  expect(rect.right).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
  expect(rect.bottom).toBeLessThanOrEqual(PHONE_VIEWPORT.height);
}

test.describe("AFTERSIGN M-LOOP round-two entry", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played first round keeps every round-two job reachable on phone", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/aftersign/?slot=mloop-round-two-entry-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    const firstRoundTray = page.locator("#offeredJobs");
    await expect(firstRoundTray).toHaveAttribute("data-mloop-divergence-memory", "fresh");
    const firstRoundJob = firstRoundTray.locator("button[data-offered-job-id]");
    await expect(firstRoundJob).toHaveCount(1);
    await firstRoundJob.tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    const acknowledgeRoute = page.locator('button[data-choice-id="acknowledge-kiosk"]');
    await expect(acknowledgeRoute).toHaveText("Acknowledge route");
    await acknowledgeRoute.tap();
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await page.locator('button[data-return-reason="blunt"]:not([disabled])').tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "packet-offered");
    const secondRoundTray = page.locator("#offeredJobs");
    await expect(secondRoundTray).toHaveAttribute("data-mloop-divergence-memory", "completed");
    const secondRoundJobs = secondRoundTray.locator("button[data-offered-job-id]");
    await expect(secondRoundJobs).toHaveCount(2);
    await expectFullyInsidePhone(page, '#offeredJobs [data-aftersign-job-offer-route-risk]');
    await expectFullyInsidePhone(page, 'button[data-offered-job-id="job-night-transfer"]');
    await expectFullyInsidePhone(page, 'button[data-offered-job-id="job-signed-receipt"]');

    // This is the player outcome: the previously clipped second control is
    // tapped through the actual touch surface, not the game-state harness.
    const signedReceipt = secondRoundTray.locator(
      'button[data-offered-job-id="job-signed-receipt"]',
    );
    await signedReceipt.tap();
    await expect(signedReceipt).toHaveAttribute("data-aftersign-job-take", "armed");
  });
});
