import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader + first WebGL context can exceed the
// Playwright default even when the story/state logic is correct.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Types mirror the ACTUAL aftersign/index.html __game surface at HEAD
// (not the aspirational spec surface in docs/flagship/story-state-contract.md).
// The harness cannot assert against a surface the impl does not expose —
// a test that throws before its load-bearing assertion is a test that
// proves nothing. When the impl grows the spec fields (delivery.outcome,
// player.flags, save.authority, save.lastLoadProof), tighten this shape
// and the assertions below in lockstep.
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

test.describe("AFTERSIGN durable save/load contract", () => {
  // Spec: docs/flagship/story-state-contract.md → "Required tests" #3
  // (Durable save/load test) with the spec's required RED polarity:
  //   `FLAGSHIP_BREAK_MODE=local-only-save` — state survives a normal
  //   reload but fails after `clearLocalState`.
  //
  // The impl at HEAD does not yet expose the spec's dedicated
  // `forceReload({ clearLocalState })` argument, and it has no
  // `save.authority` / `save.lastLoadProof` fields to inspect. Both
  // gaps are tracked separately as impl work. Meanwhile this test
  // preserves the SAME polarity by:
  //
  //   1. Playing through packet-kept-sealed → packet-delivered so an
  //      Io memory fact is authored (index.html memoryFact()).
  //   2. forceSave() — the impl's only harness-visible flush call.
  //   3. Wiping `window.localStorage` from the test — this is the
  //      HARNESS-SIDE equivalent of `clearLocalState: true`: it removes
  //      the same store the impl currently persists to, so a reload
  //      that reconstructs state must do so from an authoritative
  //      source other than local storage.
  //   4. Cold restart via `page.goto(sameSlotUrl)` — NOT the in-page
  //      `forceReload()`, which does `readStored(); if (!saved) return`
  //      after a wipe and leaves the pre-wipe in-memory `state`
  //      untouched (a no-op that would let every assertion below pass
  //      trivially). Cold restart re-runs the module and rebuilds
  //      `state` from scratch, so anything not durably persisted is
  //      genuinely gone.
  //   5. Assert the saved memory + revision came back.
  //
  // Against the current localStorage-only impl, step 5 FAILS: after
  // the cold restart, `readStored()` returns null → state rebuilds
  // with `packet.delivered=false`, `memory=[]`, `save.revision=0`.
  // That is the RED for the right reason — the durable path does not
  // exist yet, and the harness now says so. When the impl gains a
  // server-authoritative save path (or any store that outlives
  // `localStorage.clear()`), this test flips to green without any
  // assertion changes.
  //
  // Differentiator vs `memory-prior-session.spec.ts`: that test does
  // forceSave → forceReload with local state INTACT. This one wipes
  // local state between the save and the reload. Everything else the
  // two share is the setup path; the load-bearing assertion here is
  // survival ACROSS a local-state wipe, which the prior-session test
  // does not exercise.
  test("Io memory + revision survive a local-state wipe reload", async ({ page }) => {
    // Guard retired: the server-authoritative HTTP save path landed
    // (aftersign/server-authoritative-save.js talks to the vite middleware
    // in aftersign/vite.config.ts, which holds the store in the Node
    // process — genuinely out of the browser). reloadFromSave() now
    // stamps `authority: "server"` + `lastLoadProof` truthfully because
    // the payload actually crossed a network boundary and does not live
    // in any browser bucket (localStorage, IndexedDB, cache, or
    // clear-site-data reach). Cold `page.goto` after `localStorage.clear()`
    // re-fetches from the vite Node process, so the assertions below are
    // now genuine green in the default lane. The red-polarity workflow's
    // preflight (aftersign-durable-save-redgreen.yml) detects that the
    // `FLAGSHIP_BREAK_MODE !== "local-only-save"` guard string is gone
    // and cleanly retires the red job. See the workflow's Preflight step
    // for the retirement contract.

    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-contract");

    // Hermetic slot per retry. Impl keys localStorage by
    // `aftersign:kiosk-slice:${slot}` (index.html), so a fresh slot means
    // no cross-test contamination and the wipe below is total for THIS
    // test's data.
    const slot = `durable-contract-${Date.now()}`;
    const url = `/aftersign/?slot=${slot}`;
    await page.goto(url, { waitUntil: "load" });

    // 1. Author the Io delivery-outcome memory via the impl's real
    //    choice ids ("keep-packet-sealed", "deliver-packet"). Any
    //    other id throws (index.html choose() default branch).
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-packet-sealed"));
    await waitForBeat(page, "packet-kept-sealed");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);

    // The delivery memory must exist pre-save (impl memoryFact()).
    const savedFact = beforeSave.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      savedFact,
      "deliver-packet must author an Io delivered-blue-packet memory",
    ).toBeDefined();
    expect(savedFact!.object).toBe("sealed");
    expect(savedFact!.sessionId).toBeTruthy();
    expect(beforeSave.packet.delivered).toBe(true);
    expect(beforeSave.packet.sealed).toBe(true);

    const revisionBeforeSave = beforeSave.save.revision;

    // 2. forceSave — impl's only harness call that promises to flush
    //    dirty state. Wait for the dirty bit to clear so we know the
    //    persist path ran to completion.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);
    expect(afterSave.save.revision).toBeGreaterThanOrEqual(revisionBeforeSave);
    expect(afterSave.save.dirty).toBe(false);
    const revisionAfterSave = afterSave.save.revision;

    // 3. Wipe local state, then COLD RESTART. This is the harness-side
    //    stand-in for `forceReload({ clearLocalState: true })` while the
    //    impl doesn't yet honor that argument.
    //
    //    Why cold restart and not in-page forceReload():
    //    forceReload() calls readStored() and early-returns on null
    //    (index.html reloadFromSave) — after localStorage.clear() there
    //    is nothing to read, so the in-memory `state` is never disturbed
    //    and every downstream assertion trivially passes against the
    //    pre-wipe object. That's a no-op test with zero durability
    //    signal. A page.goto reload rebuilds `state` from scratch via
    //    the module's top-level `stored = readStored()` on cold load —
    //    so anything that isn't durably persisted is genuinely lost.
    //
    //    Same slot URL: the server-authoritative store (vite middleware,
    //    keyed by playerId+slot) still holds the payload and rehydrates
    //    on cold boot. Only the localStorage bucket is wiped.
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.goto(url, { waitUntil: "load" });

    // 4. Wait for the cold-loaded module to publish its surface, then
    //    drive advance() so the recognition beat can be reached IF the
    //    durable path restored `packet.delivered` and memory. Against
    //    today's localStorage-only impl, cold reload rebuilds with
    //    `packet.delivered === false` and `memory === []`, so
    //    advance()'s guard fails and the beat stays `packet-offered` —
    //    which drives every assertion below to fail as required by the
    //    spec's `local-only-save` red polarity.
    await page.waitForFunction(() => window.__game?.version === 1, undefined, {
      timeout: WAIT_MS,
    });
    await page.evaluate(() => window.__game!.input.advance());

    const afterReload = await game(page);

    // 5. Assertions per spec #3 step 6, expressed against the impl
    //    surface as it exists today:

    // — revision survived (durable path preserved the last save).
    expect(
      afterReload.save.revision,
      "save.revision must survive local-state wipe reload — durable path required",
    ).toBe(revisionAfterSave);
    expect(afterReload.save.dirty).toBe(false);

    // — packet.delivered survived (the story flag equivalent on this
    //   impl; there is no `player.flags` bag yet).
    expect(
      afterReload.packet.delivered,
      "packet.delivered must survive local-state wipe reload",
    ).toBe(true);
    expect(afterReload.packet.sealed).toBe(true);

    // — Io delivery memory survived, byte-identical.
    const recalledFact = afterReload.npcs.io.memory.find(
      (fact) => fact.predicate === "delivered-blue-packet",
    );
    expect(
      recalledFact,
      "Io sealed-delivery memory must survive local-state wipe reload",
    ).toBeDefined();
    expect(recalledFact).toEqual(savedFact);

    // — returning line references the recalled memory id. Ties the
    //   durable contract back to the story surface: a save that
    //   restores the fact but breaks the line→memory link would pass
    //   a naive JSON round-trip and still be broken per spec's
    //   `lastLineMemoryRefs` rule.
    expect(afterReload.npcs.io.lastLineMemoryRefs).toContain(savedFact!.id);
  });
});
