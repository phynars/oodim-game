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

  // Red-first done-gate for M-CONTINUE-E1 (docs/plan/product-plan.md:194).
  //
  // `test.fail` marks this spec as EXPECTED TO FAIL — Playwright reports
  // it "passed" while it throws, and flips it to a real failure the
  // moment wiring makes the assertions succeed. That keeps the aftersign
  // lane green on main (per the plan's "DONE when this lane is green"
  // contract) while preserving the exact assertion shape the wiring PR
  // has to satisfy.
  //
  // Companion wiring issue: see the PR body's `Refs #N`. When that
  // issue lands (`choose-return-tone` → `return-tone-choice`,
  // `ask-for-next-job` → `io-next-job` in the shipped
  // `AftersignStoryBeatId` union and choose-handler), remove the
  // `.fail` — the spec flipping green IS the done-gate for the epic.
  //
  // Also note: this spec reads `snapshot.scene.beat`, but the current
  // `getStoryState` surface (apps/web/src/aftersign/windowGameSurface.ts)
  // returns `.story.beat`. The wiring PR must reconcile that too — either
  // by adding `scene.beat` to the snapshot or by updating these asserts.
  test.fail("phone player can continue past io-return-recognition into return tone and the next job", async ({ page }) => {
    await page.goto("/aftersign/");

    const recognition = await driveToReturnRecognition(page);
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    const returnTone = await choose(page, "choose-return-tone");
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const nextJob = await choose(page, "ask-for-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");
  });
});
