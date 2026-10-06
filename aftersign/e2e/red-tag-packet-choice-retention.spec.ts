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

test.describe("AFTERSIGN red-tag packet retention", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a played second packet retains Saint Orra through choice and return", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/aftersign/?slot=red-tag-retention-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);

    // Complete the visible first route to earn the second-packet offer.
    await waitForBeat(page, "packet-offered");
    await page.locator('#offeredJobs button[data-offered-job-id]').tap();
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

    // Both taps are player-facing: taking the red-tag offer arms it, then
    // #packetButton enters packet-choice. The latter used to restore blue copy.
    await waitForBeat(page, "packet-offered");
    const redTagOffer = page.locator('button[data-choice-id="accept-second-packet"]');
    await expect(redTagOffer).toBeVisible({ timeout: WAIT_MS });
    await redTagOffer.tap();

    const packetButton = page.locator("#packetButton");
    await expect(packetButton).toHaveText(/Red tag.*Saint Orra/i);
    await packetButton.tap();
    await waitForBeat(page, "packet-choice");
    await expect(packetButton).toHaveText(/Red tag.*Saint Orra/i);

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");
    // Io's recognition line is rendered into `#line` — the only line node in
    // aftersign/index.html. Earlier drafts targeted `#ioText`, which does not
    // exist in the DOM or in main.js (reviewer AI008 on PR #2205).
    await expect(page.locator("#line")).toContainText(/Red tag.*Saint Orra/i);
  });
});
