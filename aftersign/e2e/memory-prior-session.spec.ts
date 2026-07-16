import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader init + first WebGL context can exceed
// Playwright's default timeout in CI even when story/state logic is correct.
const COLD_START_MS = 90_000;
// Per-wait budget for any single window.__game observation.
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
  packet: { sealed: boolean };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  getSnapshot(): unknown;
  reset(snapshot?: unknown): Promise<void> | void;
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

test.describe("AFTERSIGN prior-session memory contract", () => {
  test("Io's recognition line is backed by a saved fact from the previous session", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "prior-session");

    await page.goto(`/aftersign/?slot=prior-session-${Date.now()}`, { waitUntil: "load" });

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);
    const savedFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    const revisionBeforeSave = beforeSave.save.revision;
    expect(savedFact?.object).toBe("sealed");
    expect(savedFact?.sessionId).toBeTruthy();

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);
    expect(afterSave.save.revision).toBeGreaterThanOrEqual(revisionBeforeSave);
    expect(afterSave.save.dirty).toBe(false);

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-return-recognition");

    const returning = await game(page);
    const recalledFact = returning.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );

    expect(returning.save.revision).toBe(afterSave.save.revision);
    expect(returning.save.dirty).toBe(false);
    expect(recalledFact).toEqual(savedFact);
    expect(returning.npcs.io.lastLineMemoryRefs).toEqual([savedFact!.id]);

    const recognitionLine = returning.npcs.io.lastLine;
    expect(recognitionLine).toContain("blue seal, unbroken");
    expect(recognitionLine).not.toMatch(/memory|system|save/i);
  });

  test("window.__game snapshot/reset restores the exact story beat", async ({ page }) => {
    await page.goto(`/aftersign/?slot=snapshot-reset-${Date.now()}`);

    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("open-packet"));
    await waitForBeat(page, "packet-choice");
    // Sealed/opened split now lives on state.packet.sealed — the beat
    // canonicalized to "packet-choice" for both branches (see
    // aftersign/flagship-beat-migration.js). Pin BOTH to preserve the
    // opened-branch round-trip intent of the snapshot/reset test.
    expect(await page.evaluate(() => window.__game!.packet.sealed)).toBe(false);

    // Story-state fields the snapshot/reset contract restores: the beat,
    // the sealed/opened branch, and Io's memory surface. Save-bookkeeping
    // (revision, dirty) is intentionally NOT asserted here — reset() writes
    // through the save layer, so revision/dirty legitimately shift post-reset.
    // Those fields have dedicated coverage in the forceReload / forceSave
    // tests below.
    const expectedPreSnapshotState = await page.evaluate(() => {
      const state = window.__game!;
      return {
        beat: state.scene.beat,
        packetSealed: state.packet.sealed,
        ioMemory: state.npcs.io.memory,
        ioLastLine: state.npcs.io.lastLine,
        ioLastLineMemoryRefs: state.npcs.io.lastLineMemoryRefs,
      };
    });

    const snapshot = await page.evaluate(() => window.__game!.getSnapshot());

    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate((saved) => window.__game!.reset(saved), snapshot);
    await waitForBeat(page, "packet-choice");

    const restored = await page.evaluate(() => {
      const state = window.__game!;
      return {
        beat: state.scene.beat,
        packetSealed: state.packet.sealed,
        ioMemory: state.npcs.io.memory,
        ioLastLine: state.npcs.io.lastLine,
        ioLastLineMemoryRefs: state.npcs.io.lastLineMemoryRefs,
      };
    });

    expect(restored).toEqual(expectedPreSnapshotState);
  });

  test("prior-session memory stays slot-scoped across save/reload", async ({ page }) => {
    const slotA = `memory-isolation-a-${Date.now()}`;
    const slotB = `memory-isolation-b-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slotA}`);
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    await page.evaluate(() => window.__game!.input.forceReload());
    await page.evaluate(() => window.__game!.input.advance());
    await waitForBeat(page, "io-return-recognition");

    const slotAState = await game(page);
    expect(
      slotAState.npcs.io.memory.some((fact) => fact.predicate === "delivered-blue-packet"),
    ).toBe(true);

    await page.goto(`/aftersign/?slot=${slotB}`);
    await waitForBeat(page, "packet-offered");

    const slotBState = await game(page);
    const leakedFacts = slotBState.npcs.io.memory.filter(
      (fact) => fact.predicate === "delivered-blue-packet",
    );

    expect(leakedFacts).toEqual([]);
    expect(slotBState.npcs.io.lastLineMemoryRefs).toEqual([]);
  });

  test("saved state survives a full page reload for the same slot", async ({ page }) => {
    const slot = `hard-reload-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const beforeReload = await game(page);

    await page.reload({ waitUntil: "load" });

    const afterReload = await game(page);

    expect(afterReload.scene.beat).toBe(beforeReload.scene.beat);
    expect(afterReload.save.revision).toBe(beforeReload.save.revision);
    expect(afterReload.save.dirty).toBe(false);
    expect(afterReload.npcs.io.memory).toEqual(beforeReload.npcs.io.memory);
    expect(afterReload.npcs.io.lastLineMemoryRefs).toEqual(beforeReload.npcs.io.lastLineMemoryRefs);
  });

  test("forceReload preserves saved beat, memory, and revision exactly", async ({ page }) => {
    const slot = `reload-exact-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const saved = await game(page);

    await page.evaluate(() => window.__game!.input.forceReload());
    const reloaded = await game(page);

    expect(reloaded.scene.beat).toBe(saved.scene.beat);
    expect(reloaded.save.revision).toBe(saved.save.revision);
    expect(reloaded.save.dirty).toBe(false);
    expect(reloaded.npcs.io.memory).toEqual(saved.npcs.io.memory);
    expect(reloaded.npcs.io.lastLineMemoryRefs).toEqual(saved.npcs.io.lastLineMemoryRefs);
  });

  test("forceSave is idempotent when no story state changed", async ({ page }) => {
    const slot = `save-idempotent-${Date.now()}`;

    await page.goto(`/aftersign/?slot=${slot}`);
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const firstSave = await game(page);

    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const secondSave = await game(page);

    expect(secondSave.scene.beat).toBe(firstSave.scene.beat);
    expect(secondSave.save.revision).toBe(firstSave.save.revision);
    expect(secondSave.save.dirty).toBe(false);
    expect(secondSave.npcs.io.memory).toEqual(firstSave.npcs.io.memory);
    expect(secondSave.npcs.io.lastLineMemoryRefs).toEqual(firstSave.npcs.io.lastLineMemoryRefs);
  });
});
