import { test, expect, Page } from "@playwright/test";

type Beat = "packet-offered" | "packet-kept-sealed" | "packet-delivered";

type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  packet: {
    delivered: boolean;
    route: string | null;
    sealed: boolean;
    deliveredAt: string | null;
  };
  npcs: {
    io: {
      memory: Array<{
        id: string;
        predicate: string;
        object: string;
        sessionId: string;
      }>;
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(choiceId: "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
  };
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

async function snapshot(page: Page): Promise<GameSurface> {
  await waitForGame(page);
  return page.evaluate(() => window.__game as GameSurface);
}

test.describe("AFTERSIGN save slot contract", () => {
  test("a saved kiosk handoff reloads in the same browser context without leaking to another slot", async ({
    browser,
  }) => {
    const slot = `save-slot-${Date.now()}`;
    const context = await browser.newContext();
    const firstPage = await context.newPage();

    await firstPage.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(firstPage, "packet-offered");
    await firstPage.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(firstPage, "packet-kept-sealed");
    await firstPage.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(firstPage, "packet-delivered");

    const dirtySnapshot = await snapshot(firstPage);
    expect(dirtySnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(dirtySnapshot.save).toEqual({ revision: 1, dirty: true });
    expect(dirtySnapshot.npcs.io.memory).toHaveLength(1);

    await firstPage.evaluate(() => window.__game!.input.forceSave());
    await firstPage.waitForFunction(() => window.__game?.save.dirty === false);
    await firstPage.close();

    const returningPage = await context.newPage();
    await returningPage.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(returningPage, "packet-delivered");

    const returningSnapshot = await snapshot(returningPage);
    expect(returningSnapshot.packet).toMatchObject({
      delivered: true,
      route: "blue rainline",
      sealed: true,
    });
    expect(returningSnapshot.save).toEqual({ revision: 1, dirty: false });
    expect(returningSnapshot.npcs.io.memory).toEqual(dirtySnapshot.npcs.io.memory);
    await returningPage.close();

    const isolatedPage = await context.newPage();
    await isolatedPage.goto(`/aftersign/?slot=${slot}-empty`);
    await waitForBeat(isolatedPage, "packet-offered");

    const isolatedSnapshot = await snapshot(isolatedPage);
    expect(isolatedSnapshot.packet.delivered).toBe(false);
    expect(isolatedSnapshot.npcs.io.memory).toEqual([]);
    expect(isolatedSnapshot.save).toEqual({ revision: 0, dirty: false });

    await context.close();
  });
});
