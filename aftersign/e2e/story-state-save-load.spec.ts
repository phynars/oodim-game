import { test, expect, Page } from "@playwright/test";

// Story-state save-write contract against the REAL aftersign surface
// (`aftersign/main.js` publishState()). This spec's ONE assertion:
// after driving packet-offered → packet-choice → packet-delivered and
// calling `input.forceSave()`, the story-state triad — `scene.beat`,
// `npcs.io.memory[]`, `save.revision` — is coherent AND the dirty flag
// clears. No reload is exercised here.
//
// Prior draft asserted a full save-then-reload round-trip against
// `storyState` / `setStoryState` / top-level `save()`/`load()` — the
// aftersign surface does not expose any of those. Reviewer Mara flagged
// it on PR #1040. The rewrite drops the invented surface and narrows
// scope to what this file uniquely owns.
//
// Deliberate scope trim (2026-08-05, PR #1040 CI iteration):
//   The COLD RELOAD half of the story-state round-trip is already gated
//   by `aftersign/e2e/save-load-durable-contract.spec.ts` — same
//   packet-offered → packet-delivered drive, same forceSave, then
//   `page.goto(url)` and re-assert `packet.delivered` + memory +
//   revision. That spec is stricter (it wipes localStorage between
//   save and reload, proving the server-authoritative path really
//   holds the state), so any assertion this file added on the reload
//   side would either duplicate it or be strictly weaker. Every extra
//   cold `page.goto` in the aftersign lane pays the SwiftShader
//   cold-start tax (#700/#506/#590/#766), which is what took the
//   sibling npc-memory-roundtrip + durable-save-load specs to
//   `test.describe.skip`. This spec pays ONE boot and asserts the
//   write-side contract only.

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
  packet: {
    delivered: boolean;
    sealed: boolean;
  };
  npcs: {
    io: {
      memory: MemoryFact[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(
      choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet",
    ): Promise<void>;
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

async function game(page: Page): Promise<GameSurface> {
  await page.waitForFunction(() => window.__game?.version === 1, undefined, {
    timeout: WAIT_MS,
  });
  return page.evaluate(() => window.__game as GameSurface);
}

test.describe("AFTERSIGN story-state save-write contract", () => {
  test("scene.beat + Io memory + save.revision are coherent after forceSave", async ({ page }) => {
    test.setTimeout(COLD_START_MS);

    // Hermetic slot per run — main.js keys localStorage by
    // `aftersign:kiosk-slice:${slot}`, so a fresh slot isolates this
    // test from every other lane's persisted state.
    const slot = `story-state-save-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // 1. Fresh boot exposes the story-state cursor and an empty
    //    memory list — the harness's write-side baseline.
    await waitForBeat(page, "packet-offered");
    const initial = await game(page);
    expect(initial.version).toBe(1);
    expect(initial.scene.beat).toBe("packet-offered");
    expect(initial.npcs.io.memory).toEqual([]);

    // 2. Drive the story forward so scene.beat + memory diverge from
    //    the fresh-boot values (otherwise "coherent after save" is a
    //    trivially-true assertion against defaults).
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);
    const deliveryFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      deliveryFact,
      "deliver-packet must author an Io delivered-blue-packet memory",
    ).toBeDefined();
    expect(deliveryFact!.object).toBe("sealed");
    expect(beforeSave.packet.delivered).toBe(true);
    expect(beforeSave.packet.sealed).toBe(true);
    const revisionBeforeSave = beforeSave.save.revision;

    // 3. forceSave — the impl's only harness-visible flush call.
    //    Contract: dirty clears, revision is monotonic.
    expect(typeof beforeSave.input.forceSave).toBe("function");
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);
    expect(afterSave.scene.beat).toBe("packet-delivered");
    expect(afterSave.packet.delivered).toBe(true);
    expect(afterSave.packet.sealed).toBe(true);
    expect(afterSave.save.dirty).toBe(false);
    expect(afterSave.save.revision).toBeGreaterThanOrEqual(revisionBeforeSave);
    // Memory list is byte-identical across the save call — forceSave
    // must not mutate the story state it is flushing.
    expect(afterSave.npcs.io.memory).toEqual(beforeSave.npcs.io.memory);
  });
});
