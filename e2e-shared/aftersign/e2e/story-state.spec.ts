// AFTERSIGN story-state contract harness (docs/flagship/story-state-contract.md).
//
// This spec is the consumer that makes aftersign/src/story/ioFirstBeat.ts
// live code: the module is imported HERE, in Node test context, as the
// canonical oracle for Io's line text, memory ids, and lastLineMemoryRefs.
// The page runtime (aftersign/index.html) keeps a byte-identical inline
// mirror; these tests fail if the two ever drift — which is the point of
// having one typed source of truth.
//
// Contract rules honored:
//   - assertions read `window.__game`, never pixels
//     (docs/plan/architecture/README.md state-contract rule);
//   - no wall-clock sleeps — every wait is `waitForFunction` on story state
//     or `input.waitForStoryIdle()` (docs/harness/no-wall-clock-waits.md);
//   - red polarity is exercised in-suite via the page's break modes
//     (`?break=drop-memory`, `?break=wrong-io-line`), so a regression that
//     deletes the memory wiring cannot pass silently;
//   - the local-fallback save MUST fail the durable proof after
//     `forceReload({ clearLocalState: true })` — asserted explicitly below.

import { test, expect, type Page } from "@playwright/test";
import {
  IO_MEMORY_ID,
  IO_FIRST_SESSION_LINES,
  IO_RETURNING_PACKET_LINES,
} from "../../../aftersign/src/story/ioFirstBeat";

// Contract §Required mappings — fragment targets the harness pins on.
const FRAGMENT = {
  sealed: "blue seal, unbroken",
  opened: "The seal did not",
} as const;

// Minimal typed view of the surface this spec reads (contract §Public surface).
type GameSurface = {
  version: number;
  scene: { id: string; beat: string; ready: boolean };
  player: { id: string; flags: Record<string, boolean | number | string> };
  delivery: { id: string; outcome: string };
  npcs: {
    io: {
      trustPosture: string;
      memories: Array<{ id: string; kind: string; source: string; sessionId: string }>;
      lastLine: string | null;
      lastLineMemoryRefs: string[];
    };
  };
  save: {
    revision: number;
    dirty: boolean;
    authority: string;
    lastLoadProof: { source: string | null; revision: number | null; playerId: string | null };
  };
};

declare global {
  interface Window {
    __game: GameSurface & {
      input: {
        choose(id: string): Promise<void>;
        advance(): Promise<void>;
        forceSave(): Promise<void>;
        forceReload(options?: { clearLocalState?: boolean }): Promise<void>;
        waitForStoryIdle(): Promise<void>;
      };
    };
  }
}

const openSurface = async (page: Page, query = "?mode=test") => {
  await page.goto("/" + query);
  // Contract: wait for version + scene.ready — state quiescence, not pixels.
  await page.waitForFunction(
    () => window.__game?.version === 1 && window.__game.scene.ready === true,
  );
};

const snapshot = (page: Page): Promise<GameSurface> =>
  page.evaluate(() =>
    JSON.parse(
      JSON.stringify({
        version: window.__game.version,
        scene: window.__game.scene,
        player: window.__game.player,
        delivery: window.__game.delivery,
        npcs: window.__game.npcs,
        save: window.__game.save,
      }),
    ),
  );

const choose = async (page: Page, choiceId: string) => {
  await page.evaluate(async (id) => {
    await window.__game.input.choose(id);
    await window.__game.input.waitForStoryIdle();
  }, choiceId);
};

const forceSave = (page: Page) =>
  page.evaluate(async () => {
    await window.__game.input.forceSave();
    await window.__game.input.waitForStoryIdle();
  });

const forceReload = (page: Page, options?: { clearLocalState?: boolean }) =>
  page.evaluate(async (opts) => {
    await window.__game.input.forceReload(opts);
    await window.__game.input.waitForStoryIdle();
  }, options);

// ---------------------------------------------------------------------------
// Oracle self-check: the typed module IS the contract's line/id table.
// If someone edits ioFirstBeat.ts away from the contract, this fails before
// any browser launches.
// ---------------------------------------------------------------------------

test("ioFirstBeat module conforms to the contract's required mappings", () => {
  expect(IO_MEMORY_ID.bluePacketSealed).toBe("io-remembers-blue-packet-sealed");
  expect(IO_MEMORY_ID.bluePacketOpened).toBe("io-remembers-blue-packet-opened");

  expect(IO_RETURNING_PACKET_LINES.sealed.text).toContain(FRAGMENT.sealed);
  expect(IO_RETURNING_PACKET_LINES.sealed.memoryRefs).toContain(
    IO_MEMORY_ID.bluePacketSealed,
  );

  expect(IO_RETURNING_PACKET_LINES.opened.text).toContain(FRAGMENT.opened);
  expect(IO_RETURNING_PACKET_LINES.opened.memoryRefs).toContain(
    IO_MEMORY_ID.bluePacketOpened,
  );

  // First-session lines never claim memory.
  for (const line of Object.values(IO_FIRST_SESSION_LINES)) {
    expect(line.memoryRefs).toHaveLength(0);
  }
});

// ---------------------------------------------------------------------------
// Contract §Required tests 1 — story-state invariant test.
// ---------------------------------------------------------------------------

test("story-state invariants: sealed first-session delivery", async ({ page }) => {
  await openSurface(page);

  const initial = await snapshot(page);
  expect(["arrival", "packet-offered"]).toContain(initial.scene.beat);
  expect(initial.scene.id).toBe("io-night-post-kiosk");
  expect(initial.delivery.id).toBe("blue-packet");
  // The page runtime must speak the module's arrival line verbatim.
  expect(initial.npcs.io.lastLine).toBe(IO_FIRST_SESSION_LINES.arrival.text);

  await choose(page, "keep-sealed");
  await choose(page, "deliver-packet");

  const after = await snapshot(page);
  expect(after.delivery.outcome).toBe("sealed");
  expect(after.scene.beat).toBe("packet-delivered");
  expect(after.player.flags.io_intro_seen).toBe(true);
  expect(after.npcs.io.trustPosture).toBe("trusted-seal");
});

// ---------------------------------------------------------------------------
// Contract §Required tests 2 — NPC-memory round-trip, both branches.
// The returning line and its memoryRefs are asserted against the imported
// module, not against copy-pasted strings.
// ---------------------------------------------------------------------------

const roundTrip = (outcome: "sealed" | "opened") => {
  const choiceId = outcome === "sealed" ? "keep-sealed" : "open-packet";
  const memoryId =
    outcome === "sealed"
      ? IO_MEMORY_ID.bluePacketSealed
      : IO_MEMORY_ID.bluePacketOpened;
  const oracle = IO_RETURNING_PACKET_LINES[outcome];

  test(`NPC-memory round-trip: ${outcome}`, async ({ page }) => {
    await openSurface(page, "?mode=test&playerId=harness-roundtrip-" + outcome);

    // Session A: deliver with the chosen outcome, then save.
    await choose(page, choiceId);
    await choose(page, "deliver-packet");
    await forceSave(page);

    // Session B: reload (normal — local save survives), return to Io.
    await forceReload(page);
    await choose(page, "return-to-io");

    const state = await snapshot(page);

    const memory = state.npcs.io.memories.find(
      (m) => m.kind === "delivery-outcome",
    );
    expect(memory?.id).toBe(memoryId);

    // Line text AND memory refs travel together — oracle is the .ts module.
    expect(state.npcs.io.lastLine).toBe(oracle.text);
    expect(state.npcs.io.lastLine).toContain(FRAGMENT[outcome]);
    expect(state.npcs.io.lastLineMemoryRefs).toEqual(oracle.memoryRefs);
    expect(state.npcs.io.lastLineMemoryRefs).toContain(memoryId);

    expect(state.save.lastLoadProof.playerId).toBe(state.player.id);
  });
};

roundTrip("sealed");
roundTrip("opened");

// ---------------------------------------------------------------------------
// Contract §save — the durable proof MUST FAIL on local-fallback.
// This slice has no server save yet; the contract says a localStorage-only
// implementation cannot satisfy the durable expectations after
// clearLocalState. We assert that honestly instead of pretending.
// ---------------------------------------------------------------------------

test("durable proof fails on local-fallback after clearLocalState (by design)", async ({ page }) => {
  await openSurface(page, "?mode=test&playerId=harness-durable");

  await choose(page, "keep-sealed");
  await choose(page, "deliver-packet");
  await forceSave(page);
  const saved = await snapshot(page);
  expect(saved.save.revision).toBeGreaterThan(0);

  await forceReload(page, { clearLocalState: true });
  const state = await snapshot(page);

  // The degraded authority is reported truthfully…
  expect(state.save.authority).toBe("local-fallback");
  // …and the durable expectations are NOT met: no load proof, no memory.
  expect(state.save.lastLoadProof.source).not.toBe("server");
  expect(
    state.npcs.io.memories.find((m) => m.kind === "delivery-outcome"),
  ).toBeUndefined();
  // When the server-backed save lands, this test flips into the contract's
  // positive durable test (§Required tests 3) and this branch must die.
});

// ---------------------------------------------------------------------------
// Contract §Required red polarity — break modes must make the memory
// assertions fail. We run the same flow under each break mode and require
// the OPPOSITE outcome, so deleting the break wiring (or the real wiring)
// turns this suite red.
// ---------------------------------------------------------------------------

test("red polarity: drop-memory break mode loses Io's memory on reload", async ({ page }) => {
  await openSurface(page, "?mode=test&break=drop-memory&playerId=harness-red-drop");

  await choose(page, "keep-sealed");
  await choose(page, "deliver-packet");
  await forceSave(page);
  await forceReload(page);
  await choose(page, "return-to-io");

  const state = await snapshot(page);
  // Memory is gone → Io falls back to the generic no-memory returning line:
  // no fragment, no refs. If this ever PASSES the green-path assertions,
  // the break mode stopped breaking anything.
  expect(
    state.npcs.io.memories.find((m) => m.kind === "delivery-outcome"),
  ).toBeUndefined();
  expect(state.npcs.io.lastLine).not.toContain(FRAGMENT.sealed);
  expect(state.npcs.io.lastLineMemoryRefs).toHaveLength(0);
});

test("red polarity: wrong-io-line break mode contradicts the saved outcome", async ({ page }) => {
  await openSurface(page, "?mode=test&break=wrong-io-line&playerId=harness-red-line");

  await choose(page, "keep-sealed");
  await choose(page, "deliver-packet");
  await forceSave(page);
  await forceReload(page);
  await choose(page, "return-to-io");

  const state = await snapshot(page);
  // Saved outcome is sealed, but the break mode flips the line selection:
  // Io speaks the OPENED line. The green-path assertion (line matches saved
  // outcome) would fail here — proving the harness catches line/memory drift.
  expect(state.delivery.outcome).toBe("sealed");
  expect(state.npcs.io.lastLine).toBe(IO_RETURNING_PACKET_LINES.opened.text);
  expect(state.npcs.io.lastLine).not.toContain(FRAGMENT.sealed);
});
