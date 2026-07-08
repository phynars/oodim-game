import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader + first WebGL context can exceed the
// Playwright default even when the story/state logic is correct.
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
  player?: { id?: string; flags?: Record<string, boolean | number | string> };
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

test.describe("AFTERSIGN durable save/load contract", () => {
  // This test is the third required test in docs/flagship/story-state-contract.md:
  // mutate a story flag + create an Io memory via harness input, forceSave,
  // capture revision, forceReload, and assert the durable surface survived
  // the reload. It is written red-first against the real contract surface
  // (window.__game.npcs.io.memory + save.revision + save.dirty), not the
  // hypothetical game.io.memory that a previous draft assumed.
  test("story flag + Io memory + revision survive a full reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-contract");

    // Use a fresh, unique slot so the test is hermetic across retries.
    const slot = `durable-contract-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // 1. Reach a point where the harness has caused an authored mutation:
    //    a sealed delivery. This creates:
    //      - a story flag (io_intro_seen / keep-sealed intent)
    //      - a delivery-outcome memory on Io with `object: "sealed"`
    //    Without this, `advance()` is a no-op and `save.dirty` never flips,
    //    which was the failure mode of the previous draft.
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    // 2. Capture the pre-save observation. The memory must already exist in
    //    the surface — that's what deliverPacket() authored.
    const beforeSave = await game(page);
    const savedFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(savedFact, "deliverPacket must have authored a delivery-outcome memory").toBeDefined();
    expect(savedFact!.object).toBe("sealed");
    expect(savedFact!.sessionId).toBeTruthy();
    const revisionBeforeSave = beforeSave.save.revision;
    const playerIdBeforeSave = beforeSave.player?.id ?? null;

    // 3. forceSave() is the only harness call that promises to flush dirty
    //    state to the authoritative store. Wait for dirty to clear — that's
    //    the observable end of the save transaction.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);
    expect(
      afterSave.save.revision,
      "revision must not go backwards across forceSave",
    ).toBeGreaterThanOrEqual(revisionBeforeSave);
    expect(afterSave.save.dirty).toBe(false);
    const revisionAfterSave = afterSave.save.revision;

    // 4. forceReload() is the durable proof: reconstruct __game from the
    //    authoritative store, not from in-memory JS. advance() then lifts
    //    the returning-recognition beat so we can observe the recalled
    //    memory as the game itself sees it.
    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-returning-recognition");

    const afterReload = await game(page);

    // 5. Revision survived (monotonic — equal or advanced, never reset).
    expect(afterReload.save.revision).toBeGreaterThanOrEqual(revisionAfterSave);
    // 6. Not dirty right after a fresh load from the authoritative store.
    expect(afterReload.save.dirty).toBe(false);

    // 7. The Io delivery-outcome memory survived byte-for-byte. This is the
    //    core durable claim: the fact came back from storage, not from
    //    reconstruction. If the impl silently regenerates the memory with a
    //    new id or sessionId, this equality check fails.
    const recalledFact = afterReload.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(recalledFact, "Io memory must survive forceReload").toBeDefined();
    expect(recalledFact).toEqual(savedFact);

    // 8. Player identity (if the impl exposes it) survived.
    if (playerIdBeforeSave !== null) {
      expect(afterReload.player?.id).toBe(playerIdBeforeSave);
    }

    // 9. Returning line references the recalled memory id — this is what
    //    ties the durable contract back to the story surface. A save that
    //    "restores" the fact but loses the line-to-memory link would pass
    //    a naive JSON round-trip and still be broken.
    expect(afterReload.npcs.io.lastLineMemoryRefs).toEqual([savedFact!.id]);
  });
});
