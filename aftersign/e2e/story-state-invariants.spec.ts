import { expect, test, type Page } from "@playwright/test";

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
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

const WAIT_MS = 60_000;

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

async function readGame(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

test("story/state invariants: memory refs always point at existing facts", async ({ page }) => {
  await page.goto(`/aftersign/?slot=story-state-invariant-${Date.now()}`, { waitUntil: "load" });

  await waitForBeat(page, "packet-offered");
  await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
  await waitForBeat(page, "packet-kept-sealed");
  await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
  await waitForBeat(page, "packet-delivered");

  const game = await readGame(page);

  expect(game.save.dirty).toBe(true);

  const memoryIds = new Set(game.npcs.io.memory.map((fact) => fact.id));
  for (const refId of game.npcs.io.lastLineMemoryRefs) {
    expect(memoryIds.has(refId)).toBe(true);
  }

  if (game.npcs.io.lastLineMemoryRefs.length > 0) {
    expect(game.npcs.io.lastLine).toBeTruthy();
  }
});
