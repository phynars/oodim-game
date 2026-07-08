import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader init + first WebGL context can exceed
// Playwright's default timeout in CI even when story/state logic is correct.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// In-page latency budget for Io's recognition beat to land after a returning
// player triggers advance(). This is measured entirely inside page.evaluate
// so it excludes Playwright RPC overhead — only the game's sync path counts.
//
// Today setBeat → publishState → syncIoLine is fully synchronous, so on a
// warm page this runs in single-digit milliseconds. Budgeted at 250ms so a
// real regression trips (e.g. someone routes recognition through a promise
// chain, a large JSON.stringify loop, or an animation gate) without flaking
// under CI's slow SwiftShader tick.
const RECOGNITION_FEEDBACK_BUDGET_MS = 250;

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
    { timeout: WAIT_MS },
  );
}

test("Io recognition line lands within the feel budget after a returning advance()", async ({
  page,
}) => {
  test.setTimeout(COLD_START_MS);

  // Set up the returning-session path against the REAL slice state contract:
  // keep the packet sealed, deliver it, persist, reload from save. This
  // mirrors memory-prior-session.spec.ts so the fixture is exactly what the
  // shipping game writes to localStorage — no fabricated keys.
  const slot = `io-recognition-latency-${Date.now()}`;
  await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-kept-sealed");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  await page.evaluate(() => window.__game!.input.forceSave());
  await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
    timeout: WAIT_MS,
  });

  // Simulate the player closing and reopening the scene: the save reload
  // resets state to "packet-delivered" with Io's memory intact but the
  // recognition beat NOT yet triggered. This is the frame where feel matters
  // — the player has stepped back into the alley and Io needs to see them.
  await page.evaluate(() => window.__game!.input.forceReload());

  // Measure the whole "advance to recognition" transition inside the page so
  // the assertion isolates the game's sync path from Playwright RPC latency.
  const result = await page.evaluate(async () => {
    const t0 = performance.now();
    await window.__game!.input.advance();
    const dt = performance.now() - t0;
    const snapshot = window.__game!;
    return {
      dt,
      beat: snapshot.scene.beat,
      lastLine: snapshot.npcs.io.lastLine,
      memoryRefs: snapshot.npcs.io.lastLineMemoryRefs,
      memoryCount: snapshot.npcs.io.memory.length,
    };
  });

  // Recognition beat actually reached — otherwise a latency number is meaningless.
  expect(result.beat).toBe("io-returning-recognition");

  // The line is the sealed-packet recognition (matches lineForBeat() in
  // aftersign/index.html). Guards against silent regressions to a generic
  // string or to the opened-packet variant.
  expect(result.lastLine).toContain("blue seal, unbroken");

  // Recognition must be BACKED by the persisted memory fact — a fast beat
  // change without the memory reference would be a hollow feel win.
  expect(result.memoryCount).toBeGreaterThan(0);
  expect(result.memoryRefs.length).toBeGreaterThan(0);

  // The feel assertion: the transition finishes within the budget.
  expect(result.dt).toBeLessThanOrEqual(RECOGNITION_FEEDBACK_BUDGET_MS);
});
