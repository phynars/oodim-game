import { expect, test, type Page } from "@playwright/test";

// AFTERSIGN M-LOOP — a player completes two rounds by touching the served page.
// The evidence deliberately reads the tray and taps its child buttons; it never
// uses window.__game.input to cause a story action.
const WAIT_MS = 10_000;
const COLD_START_MS = 60_000;

const slot = (name: string) => `two-round-divergence-${name}-${Date.now()}`;

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
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function openSlice(page: Page, saveSlot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${saveSlot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  await expect(page.locator("#offeredJobs")).toHaveAttribute("data-visible", "true", {
    timeout: WAIT_MS,
  });
}

async function recordOfferedAction(page: Page): Promise<string> {
  const tray = page.locator("#offeredJobs");
  await expect(tray).toHaveAttribute("data-visible", "true", { timeout: WAIT_MS });
  const memory = await tray.getAttribute("data-mloop-divergence-memory");
  expect(memory).not.toBeNull();

  const offer = tray.locator("button[data-offered-job-id]").first();
  await expect(offer).toBeVisible({ timeout: WAIT_MS });
  await offer.click();
  await expect(offer).toHaveAttribute("data-aftersign-job-take", "armed");
  return memory!;
}

async function completeRound(page: Page): Promise<void> {
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");

  const blunt = page
    .locator('button[data-return-reason="blunt"]:not([disabled])')
    .first();
  await expect(blunt).toBeVisible({ timeout: WAIT_MS });
  await blunt.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("M-LOOP two-round tray divergence", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a played first round changes the next round's rendered, tappable job action", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await openSlice(page, slot("played"));

    const firstRoundMemory = await recordOfferedAction(page);
    await completeRound(page);

    const secondRoundMemory = await recordOfferedAction(page);
    expect(secondRoundMemory).not.toBe(firstRoundMemory);
    await completeRound(page);
  });
});
