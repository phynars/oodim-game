import { expect, test } from "@playwright/test";

const WAIT_MS = 10_000;
const JOURNEY_TIMEOUT_MS = 60_000;

// #2166: This is a played continuation proof. It drives the visible second-
// packet control, then the visible delivery control; window.__game is read
// only to wait for boot readiness.
test.describe("AFTERSIGN second-packet continuity", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("carries Io's red-tag Saint Orra handoff onto the next offered-job board", async ({ page }) => {
    test.setTimeout(JOURNEY_TIMEOUT_MS);

    const slot = `m-loop-second-packet-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await page.waitForFunction(
      () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
      undefined,
      { timeout: WAIT_MS },
    );

    const waitForBeat = async (beatId: string) => {
      await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
    };
    const tapChoice = async (choiceId: string) => {
      const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
      await expect(choice).toBeVisible({ timeout: WAIT_MS });
      await choice.tap();
    };

    await waitForBeat("packet-offered");
    await page.locator("#packetButton").tap();
    await waitForBeat("packet-choice");
    await tapChoice("acknowledge-kiosk");
    await tapChoice("deliver-packet");
    await waitForBeat("packet-delivered");
    await waitForBeat("io-return-recognition");

    const toneChoice = page.locator('button[data-return-reason="blunt"]:not([disabled])').first();
    await expect(toneChoice).toBeVisible({ timeout: WAIT_MS });
    await toneChoice.tap();
    await waitForBeat("return-tone-choice");
    await tapChoice("ask-for-next-job");
    await waitForBeat("io-next-job");

    await tapChoice("accept-second-packet");
    await tapChoice("deliver-packet");
    await waitForBeat("packet-offered");

    await expect(page.locator("#offeredJobs")).toContainText(/red tag|Saint Orra/i, {
      timeout: WAIT_MS,
    });
  });
});
