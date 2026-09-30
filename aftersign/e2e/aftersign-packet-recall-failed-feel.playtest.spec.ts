import { expect, test, type Page } from "@playwright/test";
import { aftersignPacketRecallLine } from "../../apps/web/src/aftersign/aftersignPacketRecallCopy.js";
import {
  PACKET_RECALL_LINE_DATA_ATTR,
  PACKET_RECALL_LINE_ID,
} from "../../apps/web/src/aftersign/aftersignPacketRecallRender.ts";

const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
const WAIT_MS = 10_000;
const COLD_START_MS = 45_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
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
  await choice.tap();
}

test.describe("AFTERSIGN failed-route recall (phone tap)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("Io names the failed route when the player returns for another packet", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.goto(`/aftersign/?slot=packet-recall-failed-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    await page.locator("#job-offer-job-safe-delivery").tap();
    await page.locator("#packetButton").tap();
    await waitForBeat(page, "packet-choice");

    const tray = page.locator("#routeRiskChoice");
    const safeRoute = tray.locator(
      'button[data-aftersign-tap-choice="take-the-long-way"]:not([disabled])',
    );
    await expect(safeRoute).toBeVisible({ timeout: WAIT_MS });
    await safeRoute.tap();

    const repairRoute = tray.locator(
      'button[data-aftersign-tap-choice="repair-the-loss"]:not([disabled])',
    );
    await expect(repairRoute).toBeVisible({ timeout: WAIT_MS });
    await repairRoute.tap();
    await expect(repairRoute).toBeHidden({ timeout: WAIT_MS });

    await tapChoice(page, "acknowledge-kiosk");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "io-return-recognition");

    const bluntReturn = page
      .locator('button[data-return-reason="blunt"]:not([disabled])')
      .first();
    await expect(bluntReturn).toBeVisible({ timeout: WAIT_MS });
    await bluntReturn.tap();
    await waitForBeat(page, "return-tone-choice");
    await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-offered");

    const recall = page.locator(`#${PACKET_RECALL_LINE_ID}`);
    await expect(recall).toBeVisible({ timeout: WAIT_MS });
    await expect(recall).toHaveAttribute(PACKET_RECALL_LINE_DATA_ATTR, "failed");
    await expect(recall).toHaveText(aftersignPacketRecallLine("failed"));
  });
});
