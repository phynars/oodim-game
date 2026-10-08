import { test, expect, type Page } from "@playwright/test";

// Per-visitor save identity (the shared-save bug). Before this, every
// visitor booted as `local-slice-player`, so once the Worker save
// endpoint persisted, all of game.oodim.com read and overwrote ONE save.
//
// `?identity=visitor` makes localhost behave exactly like a real host
// (aftersign/src/playerIdentity.ts): a crypto.randomUUID() minted on
// first visit, kept in localStorage, used as the save's capability
// token. The rest of the suite keeps the legacy fixed id on localhost.
//
// Witnessed here, on the served page:
//   - player.id is a UUID, persisted under the namespaced key;
//   - a reload in the same browser keeps the id AND the save;
//   - a second browser gets a different id and does NOT see the first
//     browser's save (the exact cross-visitor leak);
//   - `?player=<id>` is an explicit override.

const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STORAGE_KEY = "aftersign:player-id:v1";

type Beat = "packet-offered" | "packet-choice" | "packet-delivered";
type GameSurface = {
  version: 1;
  scene: { beat: Beat };
  player: { id: string };
  packet: { delivered: boolean; sealed: boolean };
  save: { dirty: boolean };
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

async function waitForBeat(page: Page, beat: Beat): Promise<void> {
  await page.waitForFunction(
    (expected) => window.__game?.version === 1 && window.__game.scene.beat === expected,
    beat,
    { timeout: WAIT_MS },
  );
}

const playerIdOf = (page: Page) => page.evaluate(() => window.__game!.player.id);

test.describe("AFTERSIGN per-visitor identity", () => {
  test("each browser mints its own id; one visitor's save never reaches another", async ({ browser }) => {
    test.setTimeout(COLD_START_MS * 2);
    const slot = `per-visitor-${Date.now()}`;
    const url = `/aftersign/?identity=visitor&slot=${slot}`;
    const cleanup: Array<() => Promise<unknown>> = [];

    try {
      const contextA = await browser.newContext();
      cleanup.push(() => contextA.close());
      const pageA = await contextA.newPage();
      await pageA.goto(url, { waitUntil: "load" });
      await waitForBeat(pageA, "packet-offered");

      const idA = await playerIdOf(pageA);
      expect(idA).toMatch(UUID);
      expect(idA).not.toBe("local-slice-player");
      expect(await pageA.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)).toBe(idA);
      cleanup.push(() => pageA.request.delete(`/aftersign/save/${idA}/${slot}`));

      await pageA.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
      await waitForBeat(pageA, "packet-choice");
      await pageA.evaluate(() => window.__game!.input.choose("deliver-packet"));
      await waitForBeat(pageA, "packet-delivered");
      await pageA.evaluate(() => window.__game!.input.forceSave());
      await pageA.waitForFunction(() => window.__game?.save.dirty === false);

      // The save is keyed by A's capability id on the server.
      const saved = await pageA.request.get(`/aftersign/save/${idA}/${slot}`);
      expect(saved.status()).toBe(200);
      expect((await saved.json()).exists).toBe(true);
      // Nothing landed under the legacy shared id for this slot. Cold
      // slot returns 200 with { payload: null, exists: false } (#2227).
      const legacy = await pageA.request.get(`/aftersign/save/local-slice-player/${slot}`);
      expect(legacy.status()).toBe(200);
      expect(await legacy.json()).toEqual({ payload: null, exists: false });

      // Same browser, reload: same id, save restored.
      await pageA.reload({ waitUntil: "load" });
      await waitForBeat(pageA, "packet-delivered");
      expect(await playerIdOf(pageA)).toBe(idA);

      // A different browser: new id, cold slot — A's progress must not leak.
      const contextB = await browser.newContext();
      cleanup.push(() => contextB.close());
      const pageB = await contextB.newPage();
      await pageB.goto(url, { waitUntil: "load" });
      await waitForBeat(pageB, "packet-offered");
      const idB = await playerIdOf(pageB);
      expect(idB).toMatch(UUID);
      expect(idB).not.toBe(idA);
      expect(await pageB.evaluate(() => window.__game!.packet.delivered)).toBe(false);
    } finally {
      for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
    }
  });

  test("?player=<id> overrides the identity and is not persisted", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    const slot = `per-visitor-override-${Date.now()}`;
    await page.goto(`/aftersign/?identity=visitor&player=explicit-test-id&slot=${slot}`, { waitUntil: "load" });
    await waitForBeat(page, "packet-offered");
    expect(await playerIdOf(page)).toBe("explicit-test-id");
    expect(await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)).toBeNull();
  });
});
