import { test, expect, type Page } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture";

const WAIT_MS = 60_000;

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { version?: number } }).__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function playToSpareVigil(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, "sealed");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  const kind = page.locator('button[data-return-reason="kind"]:not([disabled])').first();
  await expect(kind).toBeVisible({ timeout: WAIT_MS });
  await kind.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "spare-vigil");
}

// Contract change (#2568): the spare-vigil ending is terminal. After
// reload the same ending card is restored, and no story-advancing
// control (including "Return to Saint Orra") is offered.
test("served spare-vigil ending survives reload as a terminal ending", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`/aftersign/?slot=orra-spare-vigil-${Date.now()}`, { waitUntil: "load" });
  await waitForVersion(page);

  await playToSpareVigil(page);
  const ending = page.locator("#episodeOneEnding [data-ending-id]").first();
  await expect(ending).toBeVisible({ timeout: WAIT_MS });
  const endingId = await ending.getAttribute("data-ending-id");
  expect(endingId).toBeTruthy();

  await page.reload({ waitUntil: "load" });
  await waitForVersion(page);
  const restored = page.locator("#episodeOneEnding [data-ending-id]").first();
  await expect(restored).toBeVisible({ timeout: WAIT_MS });
  await expect(restored).toHaveAttribute("data-ending-id", endingId as string);
  await expect(page.locator("#returnToOrra")).toHaveCount(0);
  await expect(page.locator("#packetButton")).toBeHidden();
  await expect(page.locator("#resetButton")).toBeVisible();
});
