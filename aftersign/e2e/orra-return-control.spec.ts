import { test, expect, type Page } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture";

// Served-only funnel, mirroring episode-one-ending-served.spec.ts:
// the boot beat is `packet-offered` (#packetButton), NOT a
// `keep-sealed` button — `keep-sealed` is a dispatch-only id, which is
// why the previous draft timed out at its first step (F2). The vigil
// tray renders once `accept-second-packet` lands; `light-vigil` mints
// Orra's memory fact, which is what gates `#returnToOrra` after reload.

const WAIT_MS = 60_000;

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
  await expect(button, `visible button[data-choice-id="${choiceId}"] must be present`).toBeVisible({
    timeout: WAIT_MS,
  });
  await button.click();
}

async function playToVigil(page: Page): Promise<void> {
  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, "sealed");
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");
  const kind = page.locator('button[data-return-reason="kind"]:not([disabled])').first();
  await expect(kind).toBeVisible({ timeout: WAIT_MS });
  await kind.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "accept-second-packet");
  await tapChoice(page, "light-vigil");
}

test("served return-to-Orra control restores her action greeting after reload", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`/aftersign/?slot=orra-return-control-${Date.now()}`, { waitUntil: "load" });
  await waitForVersion(page);

  // Fresh slot: no Orra memory → no return control rendered.
  await expect(page.locator("#returnToOrra")).toHaveCount(0);

  await playToVigil(page);
  await expect(page.locator("#episodeOneEnding [data-ending-id]").first()).toBeVisible({ timeout: WAIT_MS });

  await page.reload({ waitUntil: "load" });
  await waitForVersion(page);

  // Reload cannot pass unless the persisted Orra memory restored.
  await tapChoice(page, "return-to-orra");
  await expect(page.locator("#speaker")).toHaveText("Saint Orra", { timeout: WAIT_MS });
  await expect(page.locator("#line")).toContainText(/vigil/i, { timeout: WAIT_MS });
});
