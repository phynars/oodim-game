import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader init + first WebGL context can exceed
// Playwright's default timeout in CI even when story/state logic is correct.
const COLD_START_MS = 90_000;
// Per-wait budget for any single window.__game observation.
const WAIT_MS = 60_000;

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
  getSnapshot(): unknown;
  reset(snapshot?: unknown): Promise<void> | void;
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

async function game(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

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

test.describe("AFTERSIGN prior-session memory contract", () => {
  test("Io's recognition line is backed by a saved fact from the previous session", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "prior-session");

    await page.goto(`/aftersign/?slot=prior-session-${Date.now()}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);
    const savedFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    const revisionBeforeSave = beforeSave.save.revision;
    expect(savedFact?.object).toBe("sealed");
    expect(savedFact?.sessionId).toBeTruthy();

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);
    expect(afterSave.save.revision).toBeGreaterThanOrEqual(revisionBeforeSave);
    expect(afterSave.save.dirty).toBe(false);

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const returning = await game(page);
    const recalledFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );

    expect(returning.save.revision).toBe(afterSave.save.revision);
    expect(returning.save.dirty).toBe(false);
    expect(recalledFact).toEqual(savedFact);
    expect(returning.npcs.io.lastLineMemoryRefs).toEqual([savedFact!.id]);

    const recognitionLine = returning.npcs.io.lastLine;
    expect(recognitionLine).toContain("blue seal, unbroken");
    expect(recognitionLine).not.toMatch(/memory|system|save/i);
  });

  test("window.__game snapshot/reset restores the exact story beat", async ({ page }) => {
    await page.goto(`/aftersign/?slot=snapshot-reset-${Date.now()}`);

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");

    const snapshot = await page.evaluate(() => window.__game!.getSnapshot());

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate((saved) => window.__game!.reset(saved), snapshot);
    await waitForBeat(page, "packet-opened");

    const restored = await game(page);
    expect(restored.scene.beat).toBe("packet-opened");
  });
});
