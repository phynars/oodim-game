import { test, expect, type Page } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture";

const WAIT_MS = 60_000;
const SPARE_VIGIL_GREETING =
  "You spared the vigil. I carried its mercy through the night; I remember the weight you chose not to leave behind.";

async function waitForVersion(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { version?: number } }).__game?.version === 1,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(page.locator(`[data-beat-id="${beatId}"]`), `story should reach beat "${beatId}"`).toBeVisible({
    timeout: WAIT_MS,
  });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const button = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(button, `visible button[data-choice-id="${choiceId}"] must be present`).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function playToSpareVigil(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, "sealed");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");

  const returnTone = page.locator('button[data-return-reason="kind"]:not([disabled])').first();
  await expect(returnTone).toBeVisible({ timeout: WAIT_MS });
  await returnTone.click();

  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "spare-vigil");
}

test("served spare-vigil return-to-Orra control restores her mercy greeting after reload", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`/aftersign/?slot=orra-spare-vigil-return-${Date.now()}`, { waitUntil: "load" });
  await waitForVersion(page);

  await playToSpareVigil(page);
  await expect(page.locator("#episodeOneEnding [data-ending-id]").first()).toBeVisible({ timeout: WAIT_MS });

  await page.reload({ waitUntil: "load" });
  await waitForVersion(page);

  const returnToOrra = page.locator("#returnToOrra");
  await expect(returnToOrra).toBeVisible({ timeout: WAIT_MS });
  await returnToOrra.click();
  await expect(page.locator("#speaker")).toHaveText("Saint Orra", { timeout: WAIT_MS });
  await expect(page.locator("#line")).toContainText(SPARE_VIGIL_GREETING, { timeout: WAIT_MS });
});
