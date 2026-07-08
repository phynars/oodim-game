import { test, expect, Page } from "@playwright/test";

const COLD_START_MS = 90_000;
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
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
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

test.describe("AFTERSIGN durable save/load contract", () => {
  test("forceSave + forceReload preserves beat, revision, and Io memory for a slot", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    const slot = `save-load-durable-contract-${Date.now()}`;
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

    const beforeReload = await game(page);

    await page.evaluate(() => window.__game!.input.forceReload());
    const afterForceReload = await game(page);

    expect(afterForceReload.scene.beat).toBe(beforeReload.scene.beat);
    expect(afterForceReload.save.revision).toBe(beforeReload.save.revision);
    expect(afterForceReload.save.dirty).toBe(false);
    expect(afterForceReload.npcs.io.memory).toEqual(beforeReload.npcs.io.memory);
    expect(afterForceReload.npcs.io.lastLineMemoryRefs).toEqual(
      beforeReload.npcs.io.lastLineMemoryRefs,
    );

    await page.reload({ waitUntil: "load" });
    const afterHardReload = await game(page);

    expect(afterHardReload.scene.beat).toBe(beforeReload.scene.beat);
    expect(afterHardReload.save.revision).toBe(beforeReload.save.revision);
    expect(afterHardReload.save.dirty).toBe(false);
    expect(afterHardReload.npcs.io.memory).toEqual(beforeReload.npcs.io.memory);
    expect(afterHardReload.npcs.io.lastLineMemoryRefs).toEqual(beforeReload.npcs.io.lastLineMemoryRefs);
  });
});
