import { expect, test, type Page } from "@playwright/test";
import { aftersignJobAcceptedLine } from "../../apps/web/src/aftersign/aftersignJobAcceptedCopy.js";

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 10_000;
const SAFE_DELIVERY_JOB_ID = "job-safe-delivery";
const SAFE_DELIVERY_OFFER_ID = "job-offer-job-safe-delivery";

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __game?: { scene?: { ready?: boolean } } })
        .__game?.scene?.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
}

async function waitForBeat(page: Page, beat: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const value = (
            window as unknown as { __game?: { scene?: { beat?: unknown } } }
          ).__game?.scene?.beat;
          return typeof value === "string" ? value : null;
        }),
      { timeout: WAIT_MS },
    )
    .toBe(beat);
}

test.describe("AFTERSIGN M-LOOP first job acknowledgement", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("a phone player can take Io's first offered job and see what was accepted", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=mloop-ack-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForReady(page);
    await waitForBeat(page, "packet-offered");

    const offeredJob = page.locator(`#${SAFE_DELIVERY_OFFER_ID}`);
    await expect(offeredJob).toBeVisible({ timeout: WAIT_MS });
    await expect(offeredJob).toBeEnabled({ timeout: WAIT_MS });
    await offeredJob.tap();

    const acceptedLine = page.locator("#jobTakeAckLine");
    await expect(acceptedLine).toHaveText(
      aftersignJobAcceptedLine(SAFE_DELIVERY_JOB_ID),
      { timeout: WAIT_MS },
    );
    await expect(acceptedLine).toHaveAttribute(
      "data-aftersign-job-take-ack",
      SAFE_DELIVERY_JOB_ID,
    );
  });
});
