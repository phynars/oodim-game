import { expect, test, type Page } from "@playwright/test";

const WAIT_MS = 30_000;

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choice: string): Promise<void> {
  const control = page.locator(`button[data-choice-id="${choice}"]:not([disabled])`).first();
  await expect(control).toBeVisible({ timeout: WAIT_MS });
  await control.click();
}

test.describe("AFTERSIGN untouched packet memory is served and player-driven (#3083)", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("safe-job delivery without touching the packet does not claim the player kept its seal", async ({ page }) => {
    await page.goto(`/aftersign/?slot=untouched-packet-memory-${Date.now()}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");

    const safeJob = page.getByRole("button", { name: "Take the safe job" });
    await expect(safeJob).toBeVisible({ timeout: WAIT_MS });
    await safeJob.click();
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    const line = page.locator("#line");
    await expect(line).not.toContainText(/seal, unbroken|Still sealed|seal held|closed hands/i);

    await page.locator('button[data-return-reason="kind"]').click();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await tapChoice(page, "accept-second-packet");
    await expect(page.locator("#episodeOneEnding")).not.toContainText(/kept the seal|closed hands/i);
  });
});
