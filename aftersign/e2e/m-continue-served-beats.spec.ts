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
        choose?: (choiceId: string) => unknown | Promise<unknown>;
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

async function choose(page: Page, choiceId: string): Promise<FlagshipSnapshot> {
  await page.evaluate(async (id) => {
    const chooseInput = window.__game?.input?.choose;
    if (!chooseInput) throw new Error("window.__game.input.choose is missing");
    await chooseInput(id);
    await window.__game?.input?.waitForStoryIdle?.();
  }, choiceId);
  return snapshot(page);
}

async function driveToReturnRecognition(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);

  const route = ["keep-sealed", "deliver-packet", "return-to-io"];

  let current = await snapshot(page);
  for (const choiceId of route) {
    if (current.scene?.beat === "io-return-recognition") break;
    current = await choose(page, choiceId);
  }

  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe("io-return-recognition");

  return snapshot(page);
}

test.describe("M-CONTINUE served-page extent", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  // Done-gate for M-CONTINUE-E1 (docs/plan/product-plan.md:194).
  //
  // Wiring landed in the same PR that removed the `.fail` marker:
  // `aftersign/main.js` now handles `choose('choose-return-tone')` →
  // `setBeat('return-tone-choice')` and `choose('ask-for-next-job')`
  // → `setBeat('io-next-job')`, and `lineForBeat()` speaks
  // `AFTERSIGN_NEXT_JOB_BEAT.line` at the terminal beat. The served
  // page's `scene.beat` publishes both new IDs via the existing
  // `scene: { ...state.scene }` clone.
  test("phone player can continue past io-return-recognition into return tone and the next job", async ({ page }) => {
    await page.goto("/aftersign/");

    const recognition = await driveToReturnRecognition(page);
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    const returnTone = await choose(page, "choose-return-tone");
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const nextJob = await choose(page, "ask-for-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
  });
});
