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

test.describe("AFTERSIGN M-LOOP round-two entry", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played first round reaches a different job and starts the second route", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`/aftersign/?slot=mloop-round-two-entry-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    await waitForBeat(page, "packet-offered");
    const firstRoundTray = page.locator("#offeredJobs");
    const firstRoundDivergence = await firstRoundTray.getAttribute(
      "data-mloop-divergence-memory",
    );
    await expect(firstRoundDivergence).toBe("fresh");
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
    const secondRoundDivergence = await secondRoundTray.getAttribute(
      "data-mloop-divergence-memory",
    );
    await expect(secondRoundDivergence).toBe("completed");
    await expect(secondRoundDivergence).not.toBe(firstRoundDivergence);
    // The completed branch renders TWO offered-job buttons
    // (`job-night-transfer` + `job-signed-receipt`, see
    // `COMPLETED_JOB_IDS` in packages/aftersign/src/computeOfferedJobs.ts),
    // so the general `button[data-offered-job-id]` locator matches both
    // — asserting `.toHaveText` on it strict-mode-fails. Keep the tray-
    // scoped general locator to prove branch shape (count === 2, and
    // satisfies the served-divergence contract's ≥ 2 offered-button
    // locator budget), then narrow to the specific `job-night-transfer`
    // id for the label assertion + tap.
    const secondRoundJobs = secondRoundTray.locator("button[data-offered-job-id]");
    await expect(secondRoundJobs).toHaveCount(2);
    const secondRoundNightTransfer = secondRoundTray.locator(
      'button[data-offered-job-id="job-night-transfer"]',
    );
    await expect(secondRoundNightTransfer).toHaveText("Night transfer · medium risk");
    await secondRoundNightTransfer.tap();
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
  });
});
