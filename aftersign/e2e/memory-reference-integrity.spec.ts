import { expect, test, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

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
      lastLineMemoryRefs: string[];
    };
  };
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

test.describe("AFTERSIGN memory reference integrity", () => {
  test("lastLineMemoryRefs always points at facts that exist in io.memory", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `memory-ref-integrity-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");

    const firstRun = await game(page);
    expect(firstRun.npcs.io.lastLineMemoryRefs).toEqual([]);

    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-return-recognition");

    const returning = await game(page);
    const factsById = new Map(returning.npcs.io.memory.map((fact) => [fact.id, fact]));

    expect(returning.npcs.io.lastLineMemoryRefs.length).toBeGreaterThan(0);
    for (const memoryRef of returning.npcs.io.lastLineMemoryRefs) {
      expect(factsById.has(memoryRef)).toBe(true);
    }

    const deliveredFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(deliveredFact).toBeDefined();
    expect(returning.npcs.io.lastLineMemoryRefs).toContain(deliveredFact!.id);
  });
});
