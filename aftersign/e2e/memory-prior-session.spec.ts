import { test, expect, Page } from "@playwright/test";

type Beat =
  | "arrival"
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

// SKIP CONTRACT (see PR #427 review):
//
// The assertions below target the `window.__game` surface described in
// `aftersign/src/state-contract.ts`. The current `aftersign/index.html` is a
// preview shell that does NOT yet publish that surface — no `version: 1`, no
// `input.choose/advance/forceSave/forceReload`, no `scene.beat`, no
// `npcs.io.memory`. Running this spec today times out on the very first
// `waitForBeat(page, "packet-offered")` call.
//
// The failing-first discipline this harness enforces ("no story beat exists
// unless a harness assertion asserts it") is intact — the spec, types, and
// wiring are here and reviewed. But this PR also lands the mandatory
// `aftersign` CI lane, which means an un-skipped red spec would gate the lane
// (and every subsequent aftersign PR) permanently until the scene ships.
//
// Resolution: land the spec as `test.skip` so the wiring merges green. The
// impl PR that publishes `window.__game` per the state contract MUST flip
// `test.skip` → `test` in the same diff — that flip is the moment the harness
// gate becomes real. Do NOT delete this spec on the impl PR; un-skip it.
test.describe("AFTERSIGN prior-session memory contract", () => {
  test.skip("Io's recognition line is backed by a saved fact from the previous session", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=prior-session-${Date.now()}`);

    await waitForBeat(page, "packet-offered");
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
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const returning = await game(page);
    const recalledFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );

    expect(recalledFact).toEqual(savedFact);
    expect(returning.npcs.io.lastLineMemoryRefs).toEqual([savedFact!.id]);

    const recognitionLine = returning.npcs.io.lastLine;
    expect(recognitionLine).toContain("blue seal, unbroken");
    expect(recognitionLine).not.toMatch(/memory|system|save/i);
  });
});
