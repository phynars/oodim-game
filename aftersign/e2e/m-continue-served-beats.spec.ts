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

/**
 * Tap a choice whose runtime commit is gated by a settle window
 * (e.g. `choose-return-tone` is rejected inside the
 * `RECOGNITION_SETTLE_MS` guard in aftersign/main.js). The button
 * renders enabled immediately, so a one-shot click can land inside
 * the gate and be dropped silently — the player experience is "nothing
 * happened, try again." We model that with a condition-based retry:
 * click, snapshot, and if the beat hasn't flipped yet, click again on
 * the next poll tick. No wall-clock sleep required
 * (see e2e-shared/no-wall-clock-waits/README.md).
 */
async function tapChoiceUntilBeat(
  page: Page,
  choiceId: string,
  expectedBeat: string,
): Promise<FlagshipSnapshot> {
  await expect
    .poll(
      async () => {
        const choice = page
          .locator(`button[data-choice-id="${choiceId}"]:not([disabled])`)
          .first();
        if (await choice.isVisible()) {
          await choice.click().catch(() => {
            // Button may have been re-rendered between isVisible and
            // click (recognition beat re-stamps the same DOM node);
            // the next poll tick will relocate it.
          });
        }
        const current = await snapshot(page);
        return current.scene?.beat;
      },
      { timeout: WAIT_MS },
    )
    .toBe(expectedBeat);
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

    // Tap the rendered phone choice. The `choose-return-tone` branch
    // in aftersign/main.js is gated by `RECOGNITION_SETTLE_MS` — a
    // tap that lands inside that window is rejected silently. A
    // condition-based retry (not a wall-clock sleep) tries the tap
    // again on each poll tick until the beat flips, which is what a
    // real player would do if their first tap "didn't take."
    const returnTone = await tapChoiceUntilBeat(
      page,
      "choose-return-tone",
      "return-tone-choice",
    );
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const nextJob = await tapChoice(page, "ask-for-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
  });
});
