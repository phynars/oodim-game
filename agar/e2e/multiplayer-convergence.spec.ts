// agar — multiplayer convergence + ordering + reconnect-replay.
//
// This file is the rung #180 actually asks for. The sibling
// `multiplayer-smoke.spec.ts` proves the binding loads; this spec
// proves the THREE deterministic invariants on top of it:
//
//   1) ORDERING — canonical state equals `pureReplay(SEED, tape)`
//      from the offline reducer. Names the invariant: canonical IS
//      the deterministic reduction of the ordered input log.
//
//   2) RECONNECT-REPLAY — disconnect page B mid-tape, drive more
//      inputs on A, reconnect B; B's canonical converges to A's
//      AND to `pureReplay(fullTape, SEED)`. (The DO is the source
//      of truth; B catches up via snapshot, then both equal offline.)
//
//   3) FIXTURE-REDGREEN — the SAME spec goes RED when the Worker is
//      launched with `DESYNC_BROKEN=1`. The DO drops every 7th input;
//      canonical diverges from `pureReplay`; the ordering assertion
//      flips polarity. CI runs the spec twice and asserts both
//      polarities (see ci.yml `agar-multiplayer-fixture-redgreen`).
//
// Zero `waitForTimeout` — every gate is tick-quiesced via
// `data-tick > 0` polling or the binding's internal `tickTo`. Per
// #129 acceptance criteria the suite is wallclock-free.

import { expect, test, type Page } from "@playwright/test";
import {
  assertClientSurface,
  canonical,
  disconnect,
  driveTape,
  reconnect,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { Tape } from "../../e2e-shared/multiplayer/harness";
import {
  pureReplay,
  type InputDir,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

// Match seed must round-trip: the URL's `?seed=` parses to this number
// in worker.ts (parseInt) and the reducer's `initialState(seed)` is
// called with the same value. Use a non-1 seed so a regression that
// silently falls back to seed=1 surfaces as a state mismatch.
const SEED_STR = "1337";
const SEED = 1337;
const ROOM_URL = `/agar/?seed=${SEED_STR}`;

// `true` iff the harness Worker was launched with `DESYNC_BROKEN=1`.
// The playwright config forwards the runner env into wrangler dev; we
// re-read it here so the same SPEC FILE can assert both polarities.
// The CI fixture-redgreen lane sets this var; the green lane leaves
// it unset. This is the cleanest way to satisfy AC3 (same spec file,
// red against broken DO, green against main).
const FIXTURE_BROKEN = process.env.DESYNC_BROKEN === "1";

// Mirror multiplayer-smoke.spec.ts: gate on WS handshake + first
// snapshot before any read against `window.__game`. The smoke spec
// factors this same helper; we keep our own copy rather than import
// across spec files (Playwright's test isolation prefers self-contained
// specs).
async function waitForFirstSnapshot(page: Page): Promise<void> {
  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("agar-net-status")
            .getAttribute("data-tick"),
        ),
      { message: "first snapshot from DO" },
    )
    .toBeGreaterThan(0);
}

// Read clientId via the dual-access shape the binding uses.
async function readClientId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: { clientId: unknown };
    };
    const v = w.__game.clientId;
    return typeof v === "function" ? (v as () => string)() : (v as string);
  });
}

// Build a one-input-per-tick intent stream from a Tape. The DO is
// latest-input-wins per tick, so as long as the tape places at most
// ONE input per (tick, page) pair, the per-tick canonical apply order
// equals `tape.sort(byTick).map(ev => ({ dir: ev.input }))`. The
// reducer's `pureReplay` consumes that directly. A tick that the
// tape skips gets a `none` filler so `pureReplay` advances at the
// same rate as the DO's 20Hz interval.
//
// `finalTick` is the last tick we expect `pureReplay` to advance to —
// the spec's read happens after the page has ticked at least this far.
function buildIntentStream(
  tape: Tape<InputDir>,
  finalTick: number,
): InputIntent[] {
  const byTick = new Map<number, InputDir>();
  for (const ev of tape) byTick.set(ev.tick, ev.input);
  const out: InputIntent[] = [];
  // Reducer's step() increments `tick` from 0; the DO's first applied
  // tick is 1. The tape uses 1-based ticks (the smoke spec uses
  // tick:2..4); we replay 1..finalTick inclusive so the offline stream
  // length matches the DO's `world.tick` after `finalTick` server ticks.
  for (let t = 1; t <= finalTick; t++) {
    out.push({ dir: byTick.get(t) ?? "none" });
  }
  return out;
}

// Compare two WorldStates structurally. We compare player position
// + tick + rng (the three observable bits the DO snapshots). A field
// added in slice 4 will need to be wired in here too.
function statesEqual(a: WorldState, b: WorldState): boolean {
  return (
    a.tick === b.tick &&
    a.rng === b.rng &&
    a.player.x === b.player.x &&
    a.player.y === b.player.y
  );
}

// Quiesce a page past a given tick. We poll on `data-tick` (the same
// attribute the smoke spec gates on) — that value updates from each
// inbound snapshot, so once it crosses `target` the DO has applied at
// least `target` ticks and the page has received them. No wallclock.
async function waitForTickAtLeast(page: Page, target: number): Promise<void> {
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByTestId("agar-net-status")
            .getAttribute("data-tick"),
        ),
      { message: `tick >= ${target}` },
    )
    .toBeGreaterThanOrEqual(target);
}

test.describe("agar · multiplayer convergence (ordering + reconnect)", () => {
  test("ordering: canonical equals pureReplay(SEED, tape)", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);
      await Promise.all([
        waitForFirstSnapshot(pageA),
        waitForFirstSnapshot(pageB),
      ]);
      await assertClientSurface(pageA);
      await assertClientSurface(pageB);

      const [idA] = await Promise.all([readClientId(pageA), readClientId(pageB)]);

      // Drive a tape from page A only, one input per even tick out to
      // tick 20. That gives 10 applied inputs against the DO — enough
      // to hit the every-7th-drop cadence at least once when the
      // fixture is active (input #7 falls inside this range), so the
      // RED polarity is reliably observable.
      const dirs: InputDir[] = [
        "right",
        "right",
        "down",
        "down",
        "left",
        "left",
        "up",
        "up",
        "right",
        "down",
      ];
      const tape: Tape<InputDir> = dirs.map((input, i) => ({
        tick: (i + 1) * 2, // ticks 2, 4, 6, … 20
        clientId: idA,
        seq: i,
        input,
      }));

      await driveTape([pageA, pageB], tape);

      // Wait until the DO has ticked past the last tape entry on BOTH
      // pages. tickTo inside driveTape gates page-A; page-B has no
      // sends in this tape, so we must explicitly wait for it to
      // receive enough snapshots.
      const finalTick = 22; // 20 + 2 buffer ticks for the last input to settle
      await Promise.all([
        waitForTickAtLeast(pageA, finalTick),
        waitForTickAtLeast(pageB, finalTick),
      ]);

      const [stateA, stateB] = await Promise.all([
        canonical<WorldState>(pageA),
        canonical<WorldState>(pageB),
      ]);

      const offline = pureReplay(SEED, buildIntentStream(tape, stateA.tick));

      if (FIXTURE_BROKEN) {
        // RED polarity (AC3): the DO is dropping every 7th input, so
        // the live canonical state diverges from offline pureReplay.
        // Specifically, the player position MUST disagree — if it
        // doesn't, the DESYNC_BROKEN gate isn't actually wired into
        // the input path and the fixture isn't proving anything.
        expect(
          statesEqual(stateA, offline),
          "DESYNC_BROKEN=1: ordering invariant must be violated (live canonical should diverge from pureReplay)",
        ).toBe(false);
      } else {
        // GREEN polarity (AC1): canonical IS the deterministic
        // reduction of the ordered input log. Structural equality on
        // (tick, rng, player) — the three bits the DO snapshots.
        expect(stateA.player).toEqual(offline.player);
        expect(stateA.rng).toBe(offline.rng);
        // Two pages on the same seed agree (convergence rolled in).
        expect(stateB.player).toEqual(stateA.player);
        expect(stateB.rng).toBe(stateA.rng);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("reconnect-replay: B disconnects mid-tape, reconnects, converges to A", async ({
    browser,
  }) => {
    // Reconnect-replay is meaningful only against the GREEN DO. The
    // RED fixture's assertions belong on the ordering test above;
    // testing reconnect against a broken DO would conflate two
    // failure modes. Skip the reconnect test when the fixture is on.
    test.skip(
      FIXTURE_BROKEN,
      "reconnect-replay is asserted only against the main DO; the fixture-redgreen polarity covers the broken path via the ordering test",
    );

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await Promise.all([pageA.goto(ROOM_URL), pageB.goto(ROOM_URL)]);
      await Promise.all([
        waitForFirstSnapshot(pageA),
        waitForFirstSnapshot(pageB),
      ]);
      await assertClientSurface(pageA);
      await assertClientSurface(pageB);

      const idA = await readClientId(pageA);

      // Phase 1: shared tape (both pages present).
      const phase1: Tape<InputDir> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
      ];
      await driveTape([pageA, pageB], phase1);
      await Promise.all([
        waitForTickAtLeast(pageA, 6),
        waitForTickAtLeast(pageB, 6),
      ]);

      // Phase 2: B disconnects. A drives more inputs alone.
      await disconnect(pageB);

      const phase2: Tape<InputDir> = [
        { tick: 8, clientId: idA, seq: 2, input: "left" },
        { tick: 10, clientId: idA, seq: 3, input: "up" },
        { tick: 12, clientId: idA, seq: 4, input: "right" },
      ];
      await driveTape([pageA], phase2);
      await waitForTickAtLeast(pageA, 14);

      // Phase 3: B reconnects. The DO snapshots include the full
      // world; B catches up via the next inbound snapshot. We wait
      // until B has crossed A's current tick.
      await reconnect(pageB);
      const aTickAfterPhase2 = (await canonical<WorldState>(pageA)).tick;
      await waitForTickAtLeast(pageB, aTickAfterPhase2);

      // Convergence assertion: A and B agree.
      const [stateA, stateB] = await Promise.all([
        canonical<WorldState>(pageA),
        canonical<WorldState>(pageB),
      ]);
      expect(stateB.player).toEqual(stateA.player);
      expect(stateB.rng).toBe(stateA.rng);
      expect(stateB.tick).toBe(stateA.tick);

      // Offline equivalence: both equal pureReplay over the full
      // tape (phase1 + phase2). The DO never saw any inputs from B,
      // so the offline stream is A's intents only.
      const fullTape: Tape<InputDir> = [...phase1, ...phase2];
      const offline = pureReplay(
        SEED,
        buildIntentStream(fullTape, stateA.tick),
      );
      expect(stateA.player).toEqual(offline.player);
      expect(stateA.rng).toBe(offline.rng);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
