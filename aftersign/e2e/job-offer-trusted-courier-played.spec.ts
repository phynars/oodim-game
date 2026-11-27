import { expect, test, type Page } from "@playwright/test";
import { aftersignJobAcceptedLine } from "../src/ioLoopCopy.js";

const WAIT_MS = 10_000;
const COLD_START_MS = 30_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game?.scene?.ready === true,
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

async function tapReturnReason(page: Page, reason: string): Promise<void> {
  const button = page.locator(`button[data-return-reason="${reason}"]:not([disabled])`).first();
  await expect(button).toBeVisible({ timeout: WAIT_MS });
  await button.click();
}

async function reachTrustedOffers(page: Page, slot: string): Promise<void> {
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);
  await waitForBeat(page, "packet-offered");
  await page.locator("#job-offer-job-safe-delivery").click();

  // A normal tap seals the visible packet; acknowledge-kiosk is the
  // separate visible action that durably stores ROUTE_DONE.
  await page.locator("#packetButton").click();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "io-return-recognition");
  await tapReturnReason(page, "blunt");
  await waitForBeat(page, "return-tone-choice");
  await tapChoice(page, "ask-for-next-job");
  await waitForBeat(page, "io-next-job");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-offered");
}

test.describe("AFTERSIGN trusted-courier offered jobs — real-tap played path", () => {
  for (const jobId of ["job-sealed-return", "job-private-ledger"] as const) {
    test(`a sealed, acknowledged delivery exposes and accepts ${jobId}`, async ({ page }) => {
      test.setTimeout(COLD_START_MS);
      await reachTrustedOffers(page, `job-offer-trusted-${jobId}-${Date.now()}`);

      const offer = page.locator(`#job-offer-${jobId}`);
      await expect(offer).toBeVisible({ timeout: WAIT_MS });
      await expect(page.locator("#job-offer-job-night-transfer")).toHaveCount(0);
      await expect(page.locator("#job-offer-job-wax-debt-repair")).toHaveCount(0);
      await offer.click();
      await expect(page.locator("#jobTakeAckLine")).toHaveText(aftersignJobAcceptedLine(jobId));
    });
  }
});
