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

type Beat = "packet-offered" | "packet-choice" | "packet-delivered" | "io-return-recognition";

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
    await waitForBeat(firstPage, "packet-choice");
    await firstPage.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(firstPage, "packet-delivered");

    const dirtySnapshot = await snapshot(firstPage);
    expect(dirtySnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(dirtySnapshot.save).toMatchObject({ revision: 1, dirty: true });
    // One fact after a no-tap delivery (#2437 false-memory fix): the
    // delivery-outcome fact is minted by deliverPacket, but the
    // route-attention fact is omitted because the player never tapped
    // "I listened" / "I ran early" at packet-choice — `state.player.
    // secondAction` is null, so `memoryFacts()` returns a null
    // secondActionFact and `deliverPacket`'s `.filter(Boolean)` drops it.
    expect(dirtySnapshot.npcs.io.memory).toHaveLength(1);
    expect(dirtySnapshot.npcs.io.memory[0]?.kind).toBe("delivery-outcome");

    await firstPage.evaluate(() => window.__game!.input.forceSave());
    await firstPage.waitForFunction(() => window.__game?.save.dirty === false);
    await firstPage.close();

    const returningPage = await context.newPage();
    watchPageErrors(returningPage, "returning");
    await returningPage.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    // A restored delivered save is promoted by restoreFlagshipBeat to the
    // io-return-recognition beat on boot (#2747), so wait for that beat.
    await waitForBeat(returningPage, "io-return-recognition");

    const returningSnapshot = await snapshot(returningPage);
    expect(returningSnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(returningSnapshot.save).toMatchObject({ revision: 1, dirty: false });
    expect(returningSnapshot.npcs.io.memory).toEqual(dirtySnapshot.npcs.io.memory);
    await returningPage.close();

    const isolatedPage = await context.newPage();
    watchPageErrors(isolatedPage, "isolated");
    await isolatedPage.goto(`/aftersign/?slot=${slot}-empty`, { waitUntil: "load" });
    await waitForBeat(isolatedPage, "packet-offered");

    const isolatedSnapshot = await snapshot(isolatedPage);
    expect(isolatedSnapshot.packet.delivered).toBe(false);
    expect(isolatedSnapshot.npcs.io.memory).toEqual([]);
    expect(isolatedSnapshot.save).toMatchObject({ revision: 0, dirty: false });

    await context.close();
  });

  // #2766 — on game.oodim.com the /player-memory Durable Object is keyed by
  // player id only (no slot). The local vite preview has no such route
  // (404 → boot falls back to save memory), which is why this leak only
  // showed on the deployed build. Reproduce the production path by serving
  // a populated per-player record — another slot's sealed-delivery fact —
  // and assert a cold slot (no save of its own) boots, and reloads, with
  // Io remembering nothing.
  test("a cold slot does not inherit another slot's per-player memory replica across reload", async ({
    browser,
  }) => {
    test.setTimeout(COLD_START_MS);
    const otherSlotFact = {
      id: "io-remembers-blue-packet-sealed",
      kind: "delivery-outcome",
      deliveryId: "blue-packet",
      predicate: "delivered-blue-packet",
      object: "sealed",
      sessionId: "session-other-slot",
    };
    const context = await browser.newContext();
    await context.route("**/player-memory", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ facts: { ioMemory: [otherSlotFact] } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ facts: {} }),
      });
    });
    const page = await context.newPage();
    watchPageErrors(page, "cold-slot-replica");

    const coldSlot = `save-slot-cold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto(`/aftersign/?slot=${coldSlot}`, { waitUntil: "load" });
    await waitForGame(page);
    const first = await snapshot(page);
    expect(first.npcs.io.memory).toEqual([]);
    expect(first.save).toMatchObject({ revision: 0, dirty: false });
    await waitForBeat(page, "packet-offered");

    // Player-driven reload of the same cold slot: still no save, so the
    // per-player replica must still not seed Io.
    await page.reload({ waitUntil: "load" });
    await waitForGame(page);
    const reloaded = await snapshot(page);
    expect(reloaded.npcs.io.memory).toEqual([]);
    expect(reloaded.packet.delivered).toBe(false);
    await waitForBeat(page, "packet-offered");

    await context.close();
  });
});
