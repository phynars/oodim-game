import { expect, test, type Page } from "@playwright/test";
import { performPacketGesture } from "./helpers/packetGesture";

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
      input?: {
        waitForStoryIdle?: () => unknown | Promise<unknown>;
      };
    };
  }
}

const PHONE_VIEWPORT = { width: 390, height: 844 };
const WAIT_MS = 60_000;

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await window.__game?.input?.waitForStoryIdle?.();
  });
}

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  await waitForStoryIdle(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beatId: string): Promise<void> {
  await expect(
    page.locator(`[data-beat-id="${beatId}"]`),
    `story line should reach beat "${beatId}"`,
  ).toBeVisible({ timeout: WAIT_MS });
}

async function tapChoice(page: Page, choiceId: string): Promise<FlagshipSnapshot> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
  return snapshot(page);
}

async function tapReturnReason(page: Page, reason: "kind" | "evasive" | "blunt"): Promise<FlagshipSnapshot> {
  const button = page
    .locator(`button[data-return-reason="${reason}"]:not([disabled])`)
    .first();
  await expect(
    button,
    `recognition beat should expose the "${reason}" tone button`,
  ).toBeVisible({ timeout: WAIT_MS });
  await button.click();
  return snapshot(page);
}

/**
 * Drive the sealed-packet route to io-return-recognition using the
 * visible-DOM gestures only. The route Soren verified in
 * `io-continue-beats-tap-playtest.spec.ts` is:
 *   packet-offered → short-tap `#packetButton` (sealed) → packet-choice
 *   → tap `acknowledge-kiosk` → tap `deliver-packet` → packet-delivered
 *   → auto-advance (setTimeout in `deliverPacket()`) → io-return-recognition.
 *
 * `keep-sealed` / `return-to-io` are DISPATCH-ONLY ids inside
 * `choose()` (see aftersign/e2e/helpers/packetGesture.ts header);
 * they are never stamped on a rendered `data-choice-id` button, so
 * the previous route would hang at `expect(button).toBeVisible`.
 */
async function driveToReturnRecognition(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);

  await waitForBeat(page, "packet-offered");
  await performPacketGesture(page, "sealed", WAIT_MS);
  await waitForBeat(page, "packet-choice");

  await tapChoice(page, "acknowledge-kiosk");
  await tapChoice(page, "deliver-packet");
  await waitForBeat(page, "packet-delivered");

  // Auto-advance (~1180ms setTimeout in deliverPacket) → recognition.
  await waitForBeat(page, "io-return-recognition");

  return snapshot(page);
}

test.describe("M-CONTINUE served-page extent", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("phone player can continue past io-return-recognition into return tone and the next job", async ({ page }) => {
    // ISOLATED SLOT (PR #1238): the default slot maps to the SHARED
    // server-authoritative save key local-slice-player::local. Now that
    // choose-return-tone forceSave()s (#1234), a sibling default-slot
    // spec running in parallel could leave beat="return-tone-choice"
    // (or later) in the server store; this spec would then boot
    // mid-story and its drive route would no-op off-beat. Unique slot
    // per run keeps the boot hermetic.
    await page.goto(`/aftersign/?slot=m-continue-served-${Date.now()}`, {
      waitUntil: "load",
    });

    const recognition = await driveToReturnRecognition(page);
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    // The return-tone fork is driven by `data-return-reason` buttons,
    // not a `data-choice-id` — see `tapReturnReason` in
    // io-continue-beats-tap-playtest.spec.ts. Pick any tone; this spec
    // asserts the beat flips, not the authored copy.
    await tapReturnReason(page, "kind");
    await waitForBeat(page, "return-tone-choice");
    const returnTone = await snapshot(page);
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const nextJob = await tapChoice(page, "ask-for-next-job");
    await waitForBeat(page, "io-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
  });
});
