import { expect, test, type Page } from "@playwright/test";
import { AFTERSIGN_JOB_OFFER_ACTION_FEEL } from "../../apps/web/src/aftersign/ioJobOfferActionFeel";

const WAIT_MS = 10_000;

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } }).__game
        ?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

test("offered-job action feel is stamped on the visible button the player taps", async ({ page }) => {
  const slot = `job-offer-action-feel-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
  await waitForReady(page);

  const offer = page.locator("#job-offer-job-safe-delivery");
  await expect(offer).toBeVisible({ timeout: WAIT_MS });
  await expect(offer).toHaveAttribute("data-aftersign-job-risk", "safe");
  await expect(offer).toHaveCSS(
    "--aftersign-job-offer-duration",
    `${AFTERSIGN_JOB_OFFER_ACTION_FEEL.safe.durationMs}ms`,
  );

  await offer.click();
  await expect(offer).toHaveAttribute("data-aftersign-job-risk", "safe");
});
