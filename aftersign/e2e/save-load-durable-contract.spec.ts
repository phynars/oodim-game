import { test, expect, Page } from "@playwright/test";

// Cold-start budget: SwiftShader + first WebGL context can exceed the
// Playwright default even when the story/state logic is correct.
const COLD_START_MS = 90_000;
const WAIT_MS = 60_000;

// Types mirror docs/flagship/story-state-contract.md exactly. If the impl
// drifts, this test fails at the type level (any-cast reads below) or at
// the assertion level — that's the point. Don't relax these to match the
// current index.html; that's how false coverage sneaks in.
type Beat =
  | "arrival"
  | "packet-offered"
  | "packet-choice"
  | "packet-delivered"
  | "io-return-recognition";

type IoMemory = {
  id: string;
  kind: "delivery-outcome" | "return" | "route-attention" | "answer-tone";
  subject: "player";
  predicate: string;
  object: string;
  deliveryId?: "blue-packet";
  sessionId: string;
  source: "server" | "local-fallback";
};

type LastLoadProof = {
  source: "server" | "local-fallback" | null;
  revision: number | null;
  playerId: string | null;
};

type GameSurface = {
  version: 1;
  scene: { beat: Beat; ready: boolean };
  player: {
    id: string;
    name: string | null;
    flags: Record<string, boolean | number | string>;
  };
  delivery: {
    id: "blue-packet";
    outcome: "unknown" | "sealed" | "opened" | "withheld" | "returned";
  };
  npcs: {
    io: {
      memories: IoMemory[];
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    slot: "default";
    revision: number;
    lastPersistedAt: string | null;
    dirty: boolean;
    authority: "server" | "local-fallback";
    lastLoadProof: LastLoadProof;
  };
  input: {
    choose(
      choiceId: "keep-sealed" | "open-packet" | "deliver-packet" | "return-to-io",
    ): Promise<void>;
    advance(): Promise<void>;
    forceSave(): Promise<void>;
    forceReload(options?: { clearLocalState?: boolean }): Promise<void>;
    waitForStoryIdle(): Promise<void>;
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
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game.scene.ready === true,
    undefined,
    { timeout: WAIT_MS },
  );
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
  // (Durable save/load test).
  //
  // This test is deliberately RED against a localStorage-only implementation.
  // The spec's "Required red polarity" section names `local-only-save` as the
  // canonical break mode that must fail this test: state that survives a
  // normal reload but not `forceReload({ clearLocalState: true })`.
  //
  // The three fields that make this a durability test — and not a
  // local-round-trip smoke test — are:
  //
  //   1. `forceReload({ clearLocalState: true })` — wipes local browser state
  //      before reload, so the reconstruction MUST come from the authoritative
  //      store or it comes back empty.
  //   2. `save.authority === 'server'` — the impl has to declare which side
  //      won the last save. `local-fallback` is explicitly failing per spec.
  //   3. `save.lastLoadProof.source === 'server'` — the harness-visible
  //      receipt that the reload actually consulted the server, matched on
  //      revision + playerId.
  //
  // Removing any of the three collapses this into an in-memory round-trip
  // that a localStorage impl passes for free. Do not "fix" this test by
  // dropping those assertions — fix the impl to satisfy them.
  test("story flag + Io memory + revision survive clearLocalState reload from server", async ({
    page,
  }) => {
    test.setTimeout(COLD_START_MS);
    watchPageErrors(page, "durable-contract");

    // Hermetic slot per retry. The server-authoritative save path is keyed
    // by (slot, playerId); a fresh slot means no cross-test contamination.
    const slot = `durable-contract-${Date.now()}`;
    await page.goto(`/aftersign/?slot=${slot}`, { waitUntil: "load" });

    // 1. Mutate one story flag + create one Io delivery-outcome memory
    //    via harness input, per spec #3 steps 1–2. `keep-sealed` sets
    //    the packet intent; `deliver-packet` completes the delivery and
    //    is what authors the Io memory + flips `io_intro_seen`.
    await waitForBeat(page, "packet-offered");
    await page.evaluate(() => window.__game!.input.choose("keep-sealed"));
    await waitForBeat(page, "packet-choice");
    await page.evaluate(() => window.__game!.input.choose("deliver-packet"));
    await waitForBeat(page, "packet-delivered");

    const beforeSave = await game(page);

    // Story flag mutation must be visible pre-save.
    expect(
      beforeSave.player.flags.io_intro_seen,
      "keep-sealed → deliver-packet must set io_intro_seen",
    ).toBe(true);

    // Delivery outcome must be authored — this is the memory-creating event.
    expect(beforeSave.delivery.outcome).toBe("sealed");

    // The Io delivery-outcome memory must exist in the surface pre-save,
    // with source === 'server' (spec: "npcs.io.memories" → source: 'server').
    const savedMemory = beforeSave.npcs.io.memories.find(
      (m) => m.kind === "delivery-outcome" && m.deliveryId === "blue-packet",
    );
    expect(
      savedMemory,
      "deliver-packet must author a server-sourced delivery-outcome memory",
    ).toBeDefined();
    expect(savedMemory!.id).toBe("io-remembers-blue-packet-sealed");
    expect(savedMemory!.source).toBe("server");
    expect(savedMemory!.sessionId).toBeTruthy();

    // A durable player identity is required to survive the clearLocalState
    // reload — the spec explicitly names player.id as one of the survivors.
    expect(beforeSave.player.id, "player.id must be a durable identity").toBeTruthy();
    const playerIdBeforeSave = beforeSave.player.id;
    const revisionBeforeSave = beforeSave.save.revision;

    // 2. forceSave() — the only harness call that promises to flush dirty
    //    state to the AUTHORITATIVE store. Wait for dirty to clear.
    await page.evaluate(() => window.__game!.input.forceSave());
    await page.waitForFunction(() => window.__game?.save.dirty === false, undefined, {
      timeout: WAIT_MS,
    });

    const afterSave = await game(page);

    // Post-save the impl must declare server authority. A local-fallback
    // save cannot satisfy the durable contract (spec: "save.authority must
    // be `server` for the vertical-slice durable proof").
    expect(
      afterSave.save.authority,
      "save.authority must be 'server' after forceSave — spec forbids local-fallback for durable proof",
    ).toBe("server");

    // 3. Capture save.revision (spec step 4).
    const revisionAfterSave = afterSave.save.revision;
    expect(revisionAfterSave).toBeGreaterThanOrEqual(revisionBeforeSave);

    // 4. forceReload({ clearLocalState: true }) — this is the whole test.
    //    Wipes local browser state, then reconstructs __game from the
    //    authoritative store. A localStorage-only impl comes back empty.
    await page.evaluate(() =>
      window.__game!.input.forceReload({ clearLocalState: true }),
    );

    // Advance to Io's return-recognition beat so we can observe the recalled
    // memory as the story surface uses it. `return-to-io` is the authored
    // choice for this transition per spec's harness controls.
    await page.evaluate(() => window.__game!.input.choose("return-to-io"));
    await waitForBeat(page, "io-return-recognition");

    const afterReload = await game(page);

    // 5. Assertions per spec #3 step 6:

    // — save.authority === 'server' (still, after reload).
    expect(
      afterReload.save.authority,
      "save.authority must remain 'server' after clearLocalState reload",
    ).toBe("server");

    // — save.lastLoadProof.source === 'server'. This is the harness-visible
    //   receipt that the reload consulted the authoritative store, not a
    //   ghost of the wiped local state. A localStorage-only impl cannot
    //   forge this proof after clearLocalState because there is nothing
    //   left in local state to load from.
    expect(
      afterReload.save.lastLoadProof.source,
      "lastLoadProof.source must be 'server' after clearLocalState reload",
    ).toBe("server");
    expect(afterReload.save.lastLoadProof.revision).toBe(afterReload.save.revision);
    expect(afterReload.save.lastLoadProof.playerId).toBe(playerIdBeforeSave);

    // — revision survived or advanced monotonically.
    expect(afterReload.save.revision).toBeGreaterThanOrEqual(revisionAfterSave);
    expect(afterReload.save.dirty).toBe(false);

    // — story flag survived.
    expect(
      afterReload.player.flags.io_intro_seen,
      "io_intro_seen must survive clearLocalState reload",
    ).toBe(true);

    // — player.id survived.
    expect(afterReload.player.id).toBe(playerIdBeforeSave);

    // — Io memory survived, still marked source === 'server' (a reload that
    //   silently downgrades to local-fallback would be caught here).
    const recalledMemory = afterReload.npcs.io.memories.find(
      (m) => m.id === "io-remembers-blue-packet-sealed",
    );
    expect(
      recalledMemory,
      "Io sealed-delivery memory must survive clearLocalState reload",
    ).toBeDefined();
    expect(recalledMemory!.source).toBe("server");
    expect(recalledMemory).toEqual(savedMemory);

    // — the returning line references the recalled memory id. This ties
    //   the durable contract back to the story surface: a save that
    //   "restores" the fact but breaks the line→memory link would pass a
    //   naive JSON round-trip and still be broken per spec's
    //   "lastLineMemoryRefs" rule.
    expect(afterReload.npcs.io.lastLineMemoryRefs).toContain(
      "io-remembers-blue-packet-sealed",
    );
  });
});
