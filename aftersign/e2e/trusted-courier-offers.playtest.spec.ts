import { expect, test, type Page } from "@playwright/test";
import { aftersignJobAcceptedLine } from "../src/ioLoopCopy.js";

const WAIT_MS = 10_000;

async function waitForBeat(page: Page, beat: string) {
  await expect(page.locator(`[data-beat-id="${beat}"]`)).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string) {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
}

async function playSealedAcknowledgedDelivery(page: Page, offerId: string) {
  const offer = page.locator(`#job-offer-${offerId}`);
  await expect(offer).toBeVisible({ timeout: WAIT_MS });
  await offer.click();
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  const returnTone = page.locator('button[data-return-reason]:not([disabled])').first();
  await expect(returnTone).toBeVisible({ timeout: WAIT_MS });
  await returnTone.click();
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN trusted-courier offers", () => {
  for (const jobId of ["job-sealed-return", "job-private-ledger"]) {
    test(`two sealed acknowledged deliveries expose and accept ${jobId}`, async ({ page }) => {
      const slot = `trusted-courier-${jobId}-${Date.now()}`;
      await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
      await page.waitForFunction(() => (window as any).__game?.scene?.ready === true, undefined, { timeout: WAIT_MS });
      await waitForBeat(page, "packet-offered");

      test.setTimeout(180_000);
      // Two and three sealed, acknowledged deliveries stay on the completed
      // set (PR #2890 F1); only the fourth in a row earns trusted-courier.
      await playSealedAcknowledgedDelivery(page, "job-safe-delivery");
      await playSealedAcknowledgedDelivery(page, "job-night-transfer");
      await expect(page.locator("#job-offer-job-signed-receipt")).toBeVisible({ timeout: WAIT_MS });
      await expect(page.locator("#job-offer-job-sealed-return")).toHaveCount(0);
      await playSealedAcknowledgedDelivery(page, "job-signed-receipt");
      await expect(page.locator("#job-offer-job-sealed-return")).toHaveCount(0);
      await playSealedAcknowledgedDelivery(page, "job-night-transfer");

      const offer = page.locator(`#job-offer-${jobId}`);
      await expect(offer).toBeVisible({ timeout: WAIT_MS });
      await offer.click();
      await expect(page.locator("#jobTakeAckLine")).toHaveText(aftersignJobAcceptedLine(jobId));
    });
  }
});
