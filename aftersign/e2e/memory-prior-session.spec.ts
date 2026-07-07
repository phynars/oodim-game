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
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet" | "return-to-io"): Promise<void>;
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

// Un-skipped in the impl PR that ships the window.__game contract
// (version: 1, scene.beat, npcs.io.memory, input.choose/forceSave/forceReload).
// See docs/flagship/story-state-contract.md.
test.describe("AFTERSIGN prior-session memory contract", () => {
  test("Io's recognition line is backed by a saved fact from the previous session", async ({
    page,
  }) => {
    await page.goto(`/aftersign/?slot=prior-session-${Date.now()}`);

    await page.waitForFunction(() => window.__game?.version === 1);
    // Boot beat is `arrival`; advance opens the packet.
    await page.evaluate(() => window.__game!.input.advance());
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
    expect(savedFact?.id).toBe("io-remembers-blue-packet-sealed");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false);
    await page.evaluate(() => window.__game!.input.forceReload());
    // After reload the beat is `arrival` again; return-to-io triggers recognition.
    await page.waitForFunction(() => window.__game?.version === 1);
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
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
