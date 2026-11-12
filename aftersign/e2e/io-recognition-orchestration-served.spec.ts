import { expect, test, type Page } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// Served-page guard for the io-return-recognition orchestration seam
// (aftersign/src/ioRecognitionOrchestration.ts, consumed by
// aftersign/main.js lineForBeat() + syncIoLine()).
//
// The player taps through a fresh save to `io-return-recognition`, then
// reloads. The rendered `#line` must equal the canonical copy owned by
// ioRecognitionDialogue.ts — NOT the output of the orchestration wrapper,
// so a wrapper that routed the wrong tier (or the wrong sealed/opened
// branch) fails here on the played surface. The opened-tier line is
// asserted absent so a sealed/opened inversion cannot pass.
//
// Taps mirror aftersign-recognition-reload.playtest.spec.ts:
// `skip-kiosk-acknowledge` keeps routeListened=false (returning tier),
// beats are awaited via the rendered `[data-beat-id]` node, and the phone
// context needs `hasTouch` for `#packetButton.tap()`.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const SEALED_LINE = expectedIoRecognitionLine("sealed", false);
const OPENED_LINE = expectedIoRecognitionLine("opened", false);

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice, `control "${choiceId}" should be visible`).toBeVisible({
    timeout: WAIT_MS,
  });
  await choice.click();
}

async function expectSealedRecognition(page: Page): Promise<void> {
  const line = page.locator("#line");
  await expect(line).toHaveText(SEALED_LINE, { timeout: WAIT_MS });
  await expect(line).not.toHaveText(OPENED_LINE);
}

test.describe("AFTERSIGN io-return-recognition orchestration (served)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("renders the canonical sealed recognition line before and after reload", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    expect(SEALED_LINE).not.toBe(OPENED_LINE);

    const slot = `recognition-orchestration-${Date.now()}`;
    await page.goto(`/aftersign/index.html?slot=${slot}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    const packet = page.locator("#packetButton");
    await expect(packet).toBeVisible({ timeout: WAIT_MS });
    await packet.tap();

    await waitForBeat(page, "packet-choice");
    await tapChoice(page, "skip-kiosk-acknowledge");
    await tapChoice(page, "deliver-packet");
    await waitForBeat(page, "packet-delivered");

    await waitForBeat(page, "io-return-recognition");
    await expectSealedRecognition(page);

    await page.reload({ waitUntil: "load" });

    await waitForBeat(page, "io-return-recognition");
    await expectSealedRecognition(page);
  });
});
