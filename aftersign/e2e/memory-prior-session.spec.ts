import { test, expect, Page } from "@playwright/test";

type Beat =
  | "arrival"
  | "arrive-at-kiosk"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
  );
}

async function game(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1);
  return page.evaluate(() => window.__game as GameSurface);
}

// HARNESS GATE — LIVE (see PR #427 review for the original skip contract):
//
// `aftersign/index.html` now publishes the `window.__game` surface described
// in `aftersign/src/state-contract.ts` (version 1, scene.beat, npcs.io.memory,
// input.choose/advance/forceSave/forceReload). The `test.skip` → `test` flip
// landed in the same diff as the surface, per the contract in #427. This spec
// is the gate: no story beat exists unless a harness assertion asserts it.
test.describe("AFTERSIGN prior-session memory contract", () => {
  test("Io's recognition line is backed by a saved fact from the previous session", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=prior-session-${Date.now()}`);

    await waitForBeat(page, "arrive-at-kiosk");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);
    const savedFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(savedFact?.object).toBe("sealed");
    expect(savedFact?.sessionId).toBeTruthy();

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false);
    // Mark the pre-reload context, trigger the reload, then wait until BOTH
    // the marker is gone (we're in the fresh context) AND the fresh page has
    // republished window.__game. Calling advance() immediately after
    // forceReload() races the navigation: it either lands in the doomed old
    // context (beat change wiped) or in the new one before the module script
    // publishes the surface (TypeError on the non-null assertion).
    await page.evaluate(() => {
      (window as unknown as { __preReloadMarker?: boolean }).__preReloadMarker = true;
      return window.__game!.input.forceReload();
    });
    await page.waitForFunction(
      () =>
        !(window as unknown as { __preReloadMarker?: boolean }).__preReloadMarker &&
        window.__game?.version === 1,
    );
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const returning = await game(page);
    const recalledFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );

    expect(recalledFact).toEqual(savedFact);
    expect(returning.npcs.io.lastLineMemoryRefs).toEqual([savedFact!.id]);
    expect(returning.npcs.io.lastLine).toContain("blue seal, unbroken");
  });
});
