import { test, expect, Page } from "@playwright/test";

type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-opened"
  | "packet-kept-sealed"
  | "packet-delivered"
  | "io-returning-recognition";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  player: { flags: Record<string, boolean | number | string> };
  npcs: {
    io: {
      memory: Array<{
        id: string;
        predicate: string;
        object: string;
        sessionId: string;
      }>;
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

test.describe("AFTERSIGN story/state harness", () => {
  test("story beat and flag transitions expose the packet choice", async ({ page }) => {
    await page.goto(`/aftersign/?slot=flags-${Date.now()}`);

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");

    const sealed = await game(page);
    expect(sealed.player.flags.packetSealed).toBe(true);
    expect(sealed.player.flags.packetOpened).not.toBe(true);

    await page.goto(`/aftersign/?slot=opened-${Date.now()}`);
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");

    const opened = await game(page);
    expect(opened.player.flags.packetOpened).toBe(true);
    expect(opened.player.flags.packetSealed).not.toBe(true);
  });

  test("Io memory round-trips and references the exact packet fact", async ({ page }) => {
    await page.goto(`/aftersign/?slot=memory-${Date.now()}`);

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false);
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const afterReload = await game(page);
    const packetFacts = afterReload.npcs.io.memory.filter(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(packetFacts).toHaveLength(1);
    expect(packetFacts[0].object).toBe("sealed");
    expect(afterReload.npcs.io.lastLineMemoryRefs).toContain(packetFacts[0].id);
    expect(afterReload.npcs.io.lastLine).toContain("blue seal, unbroken");
  });

  test("forceSave and forceReload preserve beat, flags, memory, and revision", async ({ page }) => {
    await page.goto(`/aftersign/?slot=save-${Date.now()}`);

    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const before = await game(page);
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(
      (previousRevision) =>
        window.__game?.save.dirty === false &&
        window.__game.save.revision > previousRevision,
      before.save.revision,
    );
    const saved = await game(page);

    await page.evaluate(() => window.__game!.input.forceReload());
    await waitForBeat(page, "packet-delivered");
    const reloaded = await game(page);

    expect(reloaded.save.revision).toBe(saved.save.revision);
    expect(reloaded.player.flags.packetOpened).toBe(true);
    expect(reloaded.player.flags.packetSealed).not.toBe(true);
    expect(reloaded.npcs.io.memory).toEqual(saved.npcs.io.memory);
  });
});
