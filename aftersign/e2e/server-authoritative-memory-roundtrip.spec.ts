import { test, expect, Page } from "@playwright/test";

type MemoryFact = {
  id: string;
  predicate: string;
  object: string;
  sessionId: string;
};

type GameSurface = {
  version: 1;
  scene: { beat: string };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  input: {
    choose(choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet"): Promise<void>;
    forceSave(): Promise<void>;
  };
};

declare global {
  interface Window {
    __game?: GameSurface;
  }
}

const WAIT_MS = 60_000;

async function game(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

test.describe("AFTERSIGN server-authoritative Io memory", () => {
  test("restores June's delivered-packet recall from D1 after a browser-state wipe", async ({ page }) => {
    test.setTimeout(90_000);

    const slot = `server-memory-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;

    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      () => window.__game?.version === 1 && window.__game.scene.beat === "packet-offered",
      undefined,
      { timeout: WAIT_MS },
    );
    await page.evaluate(async () => {
      await window.__game!.input.choose("keep-packet-sealed");
      await window.__game!.input.choose("deliver-packet");
      await window.__game!.input.forceSave();
    });

    const saved = await game(page);
    const delivered = saved.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(delivered).toBeTruthy();

    await page.goto("about:blank");
    await page.context().clearCookies();
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await indexedDB.databases().then((databases) =>
        Promise.all(databases.map((database) => indexedDB.deleteDatabase(database.name!))),
      );
    });
    await page.goto("about:blank");
    await page.goto(url, { waitUntil: "load" });

    const restored = await game(page);
    expect(restored.npcs.io.memory).toContainEqual(delivered);
    expect(restored.npcs.io.lastLineMemoryRefs).toContain(delivered!.id);
  });
});
