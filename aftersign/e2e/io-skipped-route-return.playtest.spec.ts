import { expect, test, type Locator, type Page } from "@playwright/test";

import { expectedIoRecognitionLine } from "../src/ioRecognitionDialogue";

// #2511 — served WebGL playtest: a player who taps
// `skip-kiosk-acknowledge` and delivers the packet reaches
// `io-return-recognition` and SEES Io's skipped-route recognition line
// (`skippedReturn` in apps/web/src/aftersign/ioFirstSceneDialogue.ts),
// rendered by `stampIoRouteReturnLine` into `#ioRouteReturnLine`.
// The line is selected from Io's durable route-attention memory fact
// (`rememberedSkippedRoute`), so it must also survive a reload.
//
// Contrast: `acknowledge-kiosk` (route done) must NOT show it, and the
// primary `#line` packet-return recognition copy stays unchanged.
//
// Tap flow and timeouts mirror aftersign-recognition-reload.playtest.spec.ts.

const PHONE_VIEWPORT = { width: 390, height: 844 };
const COLD_START_MS = 180_000;
const WAIT_MS = 60_000;

const SKIPPED_ROUTE_LINE =
  "You skipped my route. Instinct carried you once; the next stair will remember you guessed.";

async function waitForBeat(page: Page, beatId: string): Promise<Locator> {
  const beatNode = page.locator(`[data-beat-id="${beatId}"]`);
  await expect(beatNode, `story line should reach beat "${beatId}"`).toBeVisible({
    timeout: WAIT_MS,
  });
  return beatNode;
}

async function tapChoice(page: Page, choiceId: string): Promise<void> {
  const choice = page
    .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
    .first();
  await expect(choice, `visible dialogue control for "${choiceId}"`).toBeVisible({
    timeout: WAIT_MS,
  });
  await choice.click();
}

async function playToRecognition(page: Page, kioskChoice: string): Promise<void> {
  await waitForBeat(page, "packet-offered");
  const packet = page.locator("#packetButton");
  await expect(packet).toBeVisible({ timeout: WAIT_MS });
  await packet.tap();
  await waitForBeat(page, "packet-choice");
  await tapChoice(page, kioskChoice);
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");
  await waitForBeat(page, "io-return-recognition");
}

test.describe("AFTERSIGN Io skipped-route return playtest (#2511)", () => {
  test.use({ viewport: PHONE_VIEWPORT, hasTouch: true, isMobile: true });

  test("skipping the kiosk route makes Io speak the skipped-route line at recognition", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    await page.goto(`/aftersign/index.html?slot=io-skipped-route-${Date.now()}`, {
      waitUntil: "load",
    });

    await playToRecognition(page, "skip-kiosk-acknowledge");

    // Packet-return recognition on #line is unchanged.
    await expect(page.locator("#line")).toHaveText(
      expectedIoRecognitionLine("sealed", false),
      { timeout: WAIT_MS },
    );
    const routeLine = page.locator("#ioRouteReturnLine");
    await expect(routeLine).toBeVisible({ timeout: WAIT_MS });
    await expect(routeLine).toHaveText(SKIPPED_ROUTE_LINE);
    await expect(routeLine).toHaveAttribute("data-aftersign-io-route-return", "skippedReturn");

    // Durable: selected from Io's memory, so it survives a reload.
    await page.reload({ waitUntil: "load" });
    await waitForBeat(page, "io-return-recognition");
    await expect(page.locator("#ioRouteReturnLine")).toHaveText(SKIPPED_ROUTE_LINE, {
      timeout: WAIT_MS,
    });
  });

  test("acknowledging the kiosk route does NOT show the skipped-route line", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    await page.goto(`/aftersign/index.html?slot=io-done-route-${Date.now()}`, {
      waitUntil: "load",
    });

    await playToRecognition(page, "acknowledge-kiosk");

    await expect(page.locator("#line")).not.toHaveText("", { timeout: WAIT_MS });
    await expect(page.locator("#ioRouteReturnLine")).toHaveCount(0);
  });
});
