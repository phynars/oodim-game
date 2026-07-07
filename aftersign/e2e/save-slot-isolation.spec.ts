import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader init + esm.sh cold fetch of
// three@0.165.0 (+ postprocessing subpaths) + first WebGL context can
// comfortably chew through Playwright's default 30s test timeout in CI.
// See PR #463 review — the spec logic is fine, but the harness has to
// tolerate a slow first paint or the whole lane goes red for reasons
// that have nothing to do with the invariant under test.
const COLD_START_MS = 90_000;
// Per-wait budget: any single window.__game observation should complete
// well under the total test budget, but must survive the initial module
// import + WebGL bring-up on the *first* navigation.
const WAIT_MS = 60_000;

type Beat = "packet-offered" | "packet-kept-sealed" | "packet-delivered";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  packet: {
    delivered: boolean;
    route: string | null;
    sealed: boolean;
    deliveredAt: string | null;
  };
  npcs: {
    io: {
      memory: Array<{
        id: string;
        predicate: string;
        object: string;
        sessionId: string;
      }>;
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function snapshot(page: Page): Promise<GameSurface> {
  await waitForGame(page);
  return page.evaluate(() => window.__game as GameSurface);
}

// Attach page-error / console-error listeners so a module-import failure
// (esm.sh outage, three.js load error) surfaces in the test log + trace
// instead of hiding behind a mystery waitForFunction timeout.
function watchPageErrors(page: Page, label: string): void {
  page.on("pageerror", (err) => {
    // eslint-disable-next-line no-console
    console.error(`[aftersign ${label}] pageerror:`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // eslint-disable-next-line no-console
      console.error(`[aftersign ${label}] console.error:`, msg.text());
    }
  });
}

test.describe("AFTERSIGN save slot contract", () => {
  test("a saved kiosk handoff reloads in the same browser context without leaking to another slot", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `save-slot-${Date.now()}`;
    const context = await browser.newContext();
    const firstPage = await context.newPage();
    watchPageErrors(firstPage, "first");

    await firstPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForBeat(firstPage, "packet-offered");
    await firstPage.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(firstPage, "packet-kept-sealed");
    await firstPage.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(firstPage, "packet-delivered");

    const dirtySnapshot = await snapshot(firstPage);
    expect(dirtySnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(dirtySnapshot.save).toEqual({ revision: 1, dirty: true });
    expect(dirtySnapshot.npcs.io.memory).toHaveLength(1);

    await firstPage.evaluate(() => window.__game!.input.forceSave());
    await firstPage.waitForFunction(() => window.__game?.save.dirty === false);
    await firstPage.close();

    const returningPage = await context.newPage();
    watchPageErrors(returningPage, "returning");
    await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForBeat(returningPage, "packet-delivered");

    const returningSnapshot = await snapshot(returningPage);
    expect(returningSnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(returningSnapshot.save).toEqual({ revision: 1, dirty: false });
    expect(returningSnapshot.npcs.io.memory).toEqual(dirtySnapshot.npcs.io.memory);
    await returningPage.close();

    const isolatedPage = await context.newPage();
    watchPageErrors(isolatedPage, "isolated");
    await isolatedPage.goto(`/aftersign/?slot=${slot}-empty`, { waitUntil: "load" });
    await waitForBeat(isolatedPage, "packet-offered");

    const isolatedSnapshot = await snapshot(isolatedPage);
    expect(isolatedSnapshot.packet.delivered).toBe(false);
    expect(isolatedSnapshot.npcs.io.memory).toEqual([]);
    expect(isolatedSnapshot.save).toEqual({ revision: 0, dirty: false });

    await context.close();
  });
});
