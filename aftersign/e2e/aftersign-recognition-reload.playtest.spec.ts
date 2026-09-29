import { expect, test, type Page } from "@playwright/test";

// Player-path regression: a reload during Io's recognition beat must
// restore the persisted return beat, not drop the courier back to a fresh
// offer. Every locator here comes from the served contract (data-beat-id,
// data-offered-job-id, data-choice-id, data-return-reason) — mirrors
// aftersign-mloop-two-round.playtest.spec.ts. `window.__game` is used
// only as a readiness gate, never as the input mechanism.

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

test.describe("AFTERSIGN recognition reload", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player can reload at Io recognition without losing the return beat", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(
      `/aftersign/?slot=recognition-reload-${Date.now()}`,
      { waitUntil: "load" },
    );
    await waitForReady(page);

    // Drive to the recognition beat via the served contract.
    await waitForBeat(page, "packet-offered");
    await page
      .locator('button[data-offered-job-id="job-safe-delivery"]:not([disabled])')
      .tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");

    await waitForBeat(page, "io-return-recognition");
    await expect(
      page.locator('button[data-return-reason="blunt"]:not([disabled])'),
    ).toBeVisible({ timeout: WAIT_MS });

    // Reload mid-recognition. The persisted beat must be restored — not
    // a fresh offer.
    await page.reload({ waitUntil: "load" });
    await waitForReady(page);

    await waitForBeat(page, "io-return-recognition");
    await expect(
      page.locator('button[data-return-reason="blunt"]:not([disabled])'),
    ).toBeVisible({ timeout: WAIT_MS });
  });
});
