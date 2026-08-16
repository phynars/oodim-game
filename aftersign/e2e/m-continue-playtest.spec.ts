import { expect, test, type Page } from "@playwright/test";

type FlagshipSnapshot = {
  scene?: {
    beat?: string;
  };
  npcs?: {
    io?: {
      lastLine?: string;
    };
  };
  story?: {
    completedBeats?: string[];
  };
};

declare global {
  interface Window {
    __game?: {
      version?: number;
      getSnapshot?: () => FlagshipSnapshot;
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

async function snapshot(page: Page): Promise<FlagshipSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot!());
}

async function waitForBeat(page: Page, beat: string): Promise<FlagshipSnapshot> {
  await expect
    .poll(async () => (await snapshot(page)).scene?.beat, { timeout: WAIT_MS })
    .toBe(beat);
  return snapshot(page);
}

test.describe("M-CONTINUE played extent", () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test("phone player reaches return-tone answer and next-job by tapping visible controls only", async ({ page }) => {
    // ISOLATED SLOT (PR #1238): the default slot maps to the SHARED
    // server-authoritative save key local-slice-player::local, which
    // outlives page loads for the whole preview-server lifetime. Now
    // that choose-return-tone forceSave()s (#1234), a sibling
    // default-slot spec could leave beat="return-tone-choice" in the
    // server store and this spec would boot mid-story, its taps
    // no-op'ing off-beat until waitForBeat times out. Unique slot per
    // run = cold server slot + cold localStorage key.
    await page.goto(`/aftersign/?slot=m-continue-playtest-${Date.now()}`, {
      waitUntil: "load",
    });
    await waitForGame(page);

    await page.locator("#deliverButton").click();

    const recognition = await waitForBeat(page, "io-return-recognition");
    expect(recognition.scene?.beat).toBe("io-return-recognition");

    await expect(page.locator("#acknowledgeRouteButton")).toBeVisible();
    await expect(page.locator("#skipRouteButton")).toBeVisible();
    await expect(page.locator("#deliverButton")).toBeVisible();

    await expect(page.locator("#acknowledgeRouteButton")).toContainText("Kind");
    await expect(page.locator("#skipRouteButton")).toContainText("Evasive");
    await expect(page.locator("#deliverButton")).toContainText("Blunt");

    await page.locator("#acknowledgeRouteButton").click();

    const returnTone = await waitForBeat(page, "return-tone-choice");
    expect(returnTone.scene?.beat).toBe("return-tone-choice");

    const returnToneLine = returnTone.npcs?.io?.lastLine;
    expect(typeof returnToneLine).toBe("string");
    await expect(page.locator("#line")).toHaveText(returnToneLine!);

    await expect(page.locator("#deliverButton")).toContainText("Ask for next job");
    await page.locator("#deliverButton").click();

    const nextJob = await waitForBeat(page, "io-next-job");
    expect(nextJob.scene?.beat).toBe("io-next-job");

    const nextJobLine = nextJob.npcs?.io?.lastLine;
    expect(typeof nextJobLine).toBe("string");
    await expect(page.locator("#line")).toHaveText(nextJobLine!);

    await expect(page.locator("#deliverButton")).toContainText("Deliver next packet");

    const completed = nextJob.story?.completedBeats;
    if (Array.isArray(completed)) {
      expect(completed).toContain("io-return-recognition");
      expect(completed).toContain("return-tone-choice");
      expect(completed).toContain("io-next-job");
    }
  });
});
