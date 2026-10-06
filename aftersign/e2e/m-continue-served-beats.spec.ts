import { expect, test, type Page } from "@playwright/test";

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
const WAIT_MS = 10_000;
// The shipped return-tone input deliberately rejects choices made within
// RECOGNITION_SETTLE_MS (120 ms) of entering recognition. Give the
// harness-only driver a small margin so auto-advance timing cannot make
// this acceptance test race that player-protection gate.
const RECOGNITION_SETTLE_WAIT_MS = 150;

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

async function tapChoice(page: Page, choiceId: string): Promise<FlagshipSnapshot> {
  const choice = page.locator(`button[data-choice-id="${choiceId}"]:not([disabled])`).first();
  await expect(choice).toBeVisible({ timeout: WAIT_MS });
  await choice.click();
  return snapshot(page);
}

async function driveToReturnRecognition(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);

  const route = ["keep-sealed", "deliver-packet", "return-to-io"];

  let current = await snapshot(page);
  for (const choiceId of route) {
    if (current.scene?.beat === "io-return-recognition") break;
    current = await tapChoice(page, choiceId);
  }

  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe("io-return-recognition");

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

    await page.waitForTimeout(RECOGNITION_SETTLE_WAIT_MS);
    // Tap the rendered phone choice. This production path stamps the
    // recognition interaction before the return-tone transition; the old
    // window.__game harness call bypassed that timing contract.
    const returnTone = await tapChoice(page, "choose-return-tone");
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const nextJob = await tapChoice(page, "ask-for-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
  });
});
