import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 10_000;
const slot = (name: string) => `mloop-offer-marker-${name}-${Date.now()}`;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function openOffer(page: Page, saveSlot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${saveSlot}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__game?.scene?.ready === true, undefined, {
    timeout: WAIT_MS,
  });
  await waitForBeat(page, "packet-offered");
  await expect(page.locator("#offeredJobs")).toHaveAttribute("data-visible", "true");
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.tap();
}

async function completeRound(page: Page): Promise<void> {
  await page.locator("#packetButton").tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await page.locator('button[data-return-reason="blunt"]:not([disabled])').first().tap();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("M-LOOP offer-memory marker", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a played completed round changes the rendered offer-memory state", async ({ page }) => {
    await openOffer(page, slot("completed"));
    await expect(page.locator("#offeredJobs")).toHaveAttribute(
      "data-mloop-divergence-memory",
      "fresh",
    );

    await completeRound(page);
    await expect(page.locator("#offeredJobs")).toHaveAttribute(
      "data-mloop-divergence-memory",
      "completed",
    );
  });
});
