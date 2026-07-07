import { test, expect, Page } from "@playwright/test";

type Beat =
  | "packet-offered"
  | "packet-opened"
  | "packet-delivered";

type PacketState = {
  delivered: boolean;
  route: string | null;
  sealed: boolean;
  deliveredAt: string | null;
};

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

type GameSnapshot = {
  version: 1;
  scene: { beat: Beat };
  packet: PacketState;
  npcs: { io: { memory: MemoryFact[] } };
  save: { revision: number; dirty: boolean };
};

type GameSurface = GameSnapshot & {
  getSnapshot(): GameSnapshot;
  input: {
    choose(choiceId: "open-packet" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(): Promise<void>;
  };
  resetSliceSave(): void;
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__game?.version === 1);
}

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
  );
}

async function snapshot(page: Page): Promise<GameSnapshot> {
  await waitForGame(page);
  return page.evaluate(() => window.__game!.getSnapshot());
}

test.describe("AFTERSIGN durable save/load contract", () => {
  test("packet state survives forceSave + forceReload and reset clears the slot", async ({ page }) => {
    await page.goto(`/aftersign/?slot=durable-save-load-${Date.now()}`);
    await waitForBeat(page, "packet-offered");

    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-opened");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const delivered = await snapshot(page);
    expect(delivered.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: false,
    });
    expect(delivered.packet.deliveredAt).toBeTruthy();
    expect(delivered.npcs.io.memory).toEqual([
      expect.objectContaining({
        predicate: "delivered-blue-packet",
        object: "opened",
      }),
    ]);
    expect(delivered.save.revision).toBeGreaterThan(0);
    expect(delivered.save.dirty).toBe(true);

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false);
    const saved = await snapshot(page);

    await page.evaluate(() => window.__game!.input.forceReload());
    await waitForBeat(page, "packet-delivered");
    const reloaded = await snapshot(page);

    expect(reloaded.packet).toEqual(saved.packet);
    expect(reloaded.npcs.io.memory).toEqual(saved.npcs.io.memory);
    expect(reloaded.save).toEqual(saved.save);

    // True durability: a COLD BOOT (full page reload, same slot) must
    // rehydrate beat, packet, and memory from storage — not just the
    // in-memory forceReload path. This is the assertion that catches
    // boot-time hydration regressions (e.g. beat silently resetting to
    // "packet-offered" while packet.delivered stays true).
    await page.reload();
    await waitForBeat(page, "packet-delivered");
    const coldBoot = await snapshot(page);

    expect(coldBoot.packet).toEqual(saved.packet);
    expect(coldBoot.npcs.io.memory).toEqual(saved.npcs.io.memory);
    expect(coldBoot.save).toEqual(saved.save);

    await page.evaluate(() => window.__game!.resetSliceSave());
    await waitForBeat(page, "packet-offered");
    const reset = await snapshot(page);

    expect(reset.packet).toEqual({
      delivered: false,
      route: null,
      sealed: true,
      deliveredAt: null,
    });
    expect(reset.npcs.io.memory).toEqual([]);
    expect(reset.save).toEqual({ revision: 0, dirty: false });
  });
});
