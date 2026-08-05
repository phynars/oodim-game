import { test, expect, Page } from "@playwright/test";

// Story-state save/load round-trip against the REAL aftersign surface
// (`aftersign/main.js` publishState()). The prior draft of this spec
// asserted invented members (`storyState`, `setStoryState`, top-level
// `save()`/`load()`) that publishState never exposes — reviewer Mara
// flagged it on PR #1040. The shipped surface is what the sibling
// `save-load-durable-contract.spec.ts` already reads from:
//   - `scene.beat`                — the story-state cursor
//   - `npcs.io.memory[]`          — durable memory facts
//   - `save.revision` / `dirty`   — durability telemetry
//   - `input.choose()` / `.forceSave()`  — the only harness verbs
//
// This spec's contribution alongside the durable-contract spec: it does
// a NORMAL reload (no localStorage wipe) and asserts the story cursor
// (`scene.beat`) plus memory + revision all round-trip. The durable
// contract spec exercises the harder polarity (wipe + cold restart);
// this one anchors the plain reload path.

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
    route: string | null;
    deliveredAt: string | null;
  };
  npcs: {
    io: {
      memory: MemoryFact[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: { revision: number; dirty: boolean };
  input: {
    choose(
      choiceId: "open-packet" | "keep-packet-sealed" | "deliver-packet",
    ): Promise<void>;
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

test.describe("AFTERSIGN story-state save/load round-trip", () => {
  test("scene.beat + Io memory + save.revision survive a plain reload", async ({ page }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "story-state-save-load");

    // Hermetic slot per run — main.js keys localStorage by
    // `aftersign:kiosk-slice:${slot}`, so a fresh slot isolates this
    // test from any other lane's persisted state.
    const slot = `story-state-save-load-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;
    await page.goto(url, { waitUntil: "load" });

    // 1. Prove the surface exposes the story-state cursor. This is the
    //    `hasStoryState` assertion, expressed against the real shape:
    //    scene.beat is the beat cursor + `story` object is published.
    await waitForBeat(page, "packet-offered");
    const initial = await game(page);
    expect(initial.version).toBe(1);
    expect(initial.scene.beat).toBe("packet-offered");
    expect(Array.isArray(initial.npcs.io.memory)).toBe(true);

    // 2. Drive the story forward so scene.beat + memory diverge from
    //    the fresh-boot values — otherwise the round-trip below would
    //    be trivially true against a default state.
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

    // 3. Save — `canSave` expressed as: input.forceSave() runs and the
    //    dirty flag clears (contract with buildPersistPayload/persist
    //    in aftersign/main.js).
    expect(typeof beforeSave.input.forceSave).toBe("function");
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });
    const afterSave = await game(page);
    expect(afterSave.save.revision).toBeGreaterThanOrEqual(revisionBeforeSave);
    expect(afterSave.save.dirty).toBe(false);
    const revisionAfterSave = afterSave.save.revision;

    // 4. Load — same slot, cold reload via page.goto (module re-runs
    //    top-level readAuthoritativeSave/readStored and rebuilds state
    //    from persisted bytes). This is the `canLoad` assertion: the
    //    persisted story cursor, memory, and revision come back.
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game?.version === 1, undefined, {
      timeout: WAIT_MS,
    });

    const afterReload = await game(page);

    // scene.beat round-trips (the story-state cursor).
    expect(
      afterReload.scene.beat,
      "scene.beat must survive a plain reload after forceSave",
    ).toBe("packet-delivered");

    // packet flags round-trip.
    expect(afterReload.packet.delivered).toBe(true);
    expect(afterReload.packet.sealed).toBe(true);

    // Io delivery-outcome memory round-trips byte-identical.
    const recalledFact = afterReload.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      recalledFact,
      "Io delivered-blue-packet memory must survive a plain reload",
    ).toBeDefined();
    expect(recalledFact).toEqual(deliveryFact);

    // save.revision round-trips (monotonic — no reset on load).
    expect(
      afterReload.save.revision,
      "save.revision must survive a plain reload",
    ).toBe(revisionAfterSave);
    expect(afterReload.save.dirty).toBe(false);
  });
});
