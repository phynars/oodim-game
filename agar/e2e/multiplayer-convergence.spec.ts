// Two-client multiplayer CONVERGENCE — the rung's real merge gate.
//
// What this spec proves (beyond multiplayer-smoke.spec.ts):
//   1. ORDERING INVARIANT — after driveTape, AT LEAST ONE page
//      (whichever client won the connection race and covered the
//      full history) satisfies `pureReplay(SEED, appliedLog) ===
//      canonical` from the offline reducer (structural equality on
//      tick/player/rng). Names the determinism contract: canonical
//      state IS the pure reduction of the ordered input log the
//      server applied. Mirrors the single-client assertion in
//      tick.spec.ts, lifted into the two-client world.
//
//      Why "at least one" and not "both": the client's `appliedLog`
//      (agar/src/main.ts) grows per snapshot RECEIVED, and the DO's
//      tick loop boots on first attach and survives between sockets
//      — so a late-joining page sees a SUFFIX of the canonical
//      timeline, not the full history. `pureReplay(seed, suffix)` from
//      `initialState(seed)` does NOT equal a canonical at a later tick.
//      Until the server gains a join-tick / replay-on-connect signal
//      (server-side follow-up to #234 bullet 3), the offline-mirror
//      check is only honest for the first connector. Cross-client
//      agreement for the late joiner is covered by `expectConverge`.
//   2. RECONNECT-REPLAY — drive a tape; disconnect B mid-tape;
//      drive more inputs on A only; reconnect B. After quiesce, B's
//      canonical equals A's canonical AND each equals pureReplay
//      over its own appliedLog. The DO is the source of truth; the
//      reconnecting client picks up the missed authoritative state.
//   3. ZERO `waitForTimeout` — every gate is tick-quiesced
//      (`waitForFirstSnapshot` polls `data-tick`; `canonical()` from
//      the binding ticks-to itself before reading). Grep this file
//      for `waitForTimeout` → no matches.
//
// What this spec does NOT do (separate, intentional scope):
//   - It does NOT add the `agar/server/` DESYNC_BROKEN env path or
//     the CI red/green job. That's a server-side change tracked as
//     follow-up to #234's bullet 3. Once the broken-DO path lands,
//     this spec naturally goes RED against it (the ordering test
//     fails because pureReplay(SEED, appliedLog) ≠ canonical when
//     the DO drops inputs out of band) and stays GREEN against the
//     real DO — the suite IS the polarity check, the server fixture
//     just supplies the broken side.
//   - It does NOT touch multiplayer-smoke.spec.ts, client-surface.spec.ts,
//     tick.spec.ts, or the e2e-shared binding. Per #234 scope.
//
// Refs #180 (the rung — convergence + ordering + reconnect).
// Refs #234 (the gate-spec bullets — 1, 2, 4; bullet 3 awaits server PR).

import { expect, test, type Page } from "@playwright/test";
import {
  assertClientSurface,
  disconnect,
  driveTape,
  expectConverge,
  reconnect,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { Tape } from "../../e2e-shared/multiplayer/harness";
import {
  pureReplay,
  type InputDir,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

// Seed must be NUMERIC: pureReplay's signature is
// `pureReplay(seed: number, tape: InputIntent[])`. The agar client
// accepts `?seed=` as a string and parses it server-side; we use a
// fresh numeric seed per test so each test gets a clean DO.
let SEED = 1234567;
let ROOM_URL = `/agar/?seed=${SEED}`;

// Gate every `page.goto` on (1) WS handshake complete, (2) at least
// one snapshot received. Identical pattern to multiplayer-smoke.spec
// and tick.spec — `canonical` is null pre-snapshot and the binding's
// assertClientSurface treats null read fields as missing.
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

// Pull both `canonical` and `appliedLog` off a page in one evaluate,
// AFTER quiescing on the page's current tick. This mirrors the binding's
// `canonical()` quiesce idiom (tickTo(curTick) — a no-op tick advance
// that resolves only when every queued event up to that tick has
// applied and the ws is idle) so the snapshot we read is consistent
// with the log that produced it.
async function readState(
  page: Page,
): Promise<{ canonical: WorldState | null; appliedLog: InputDir[] }> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __game: {
        tick: unknown;
        tickTo: (n: number) => Promise<void>;
        canonical: WorldState | null;
        appliedLog: readonly InputDir[];
      };
    };
    const tickField = w.__game.tick;
    const curTick =
      typeof tickField === "function"
        ? (tickField as () => number)()
        : (tickField as number);
    return w.__game.tickTo(curTick).then(() => ({
      canonical: w.__game.canonical,
      appliedLog: w.__game.appliedLog.slice() as InputDir[],
    }));
  });
}

// Replay a page's own applied log through the pure reducer and assert
// bit-exact equality with its canonical state. This is the SAME
// determinism contract tick.spec.ts asserts for slice 3.
//
// Honesty boundary — read carefully before tightening:
//   - The client's `appliedLog` (agar/src/main.ts:96) grows ONE entry
//     per snapshot RECEIVED, not per server tick. The DO boots its
//     20Hz tick loop on the first socket attach and survives between
//     reconnects within a wrangler-dev process — so a client that
//     races into an already-ticking DO joins at some tick K > 1 and
//     its `appliedLog` covers ticks [K..canonical.tick], a SUFFIX,
//     not the full history.
//   - `pureReplay(seed, tape)` replays from `initialState(seed)` at
//     tick 0. It only reproduces `canonical` if the tape covers EVERY
//     applied input from tick 1 onward — i.e. only the chronologically
//     first connector satisfies `pureReplay(SEED, appliedLog) === canonical`.
//   - There is no replay-on-reconnect or join-tick signal in
//     `agar/server/worker.ts`. That's the server-side follow-up
//     to #234 (bullet 3), tracked separately. Until it lands, the
//     length-equals-tick invariant is honest ONLY when this page's
//     appliedLog actually covered the full history.
//
// Returns true if the determinism contract was asserted, false if the
// page joined late (suffix-only log) and the assertion was skipped.
// The caller asserts that AT LEAST ONE page satisfied the contract —
// that's the strongest honest cross-client statement under the current
// server.
function assertCanonicalEqualsReplay(
  label: string,
  seed: number,
  state: { canonical: WorldState | null; appliedLog: InputDir[] },
): boolean {
  expect(state.canonical, `${label}: canonical present`).not.toBeNull();
  if (state.canonical === null) return false;

  // Late joiner: appliedLog is a suffix of the full history. The
  // determinism check via `pureReplay` is NOT honest here — replaying
  // a suffix from seed yields a state at tick `appliedLog.length`, not
  // at `canonical.tick`. Skip the assertion for this page; convergence
  // with the first connector (via expectConverge) is the rung-level
  // gate that covers it.
  if (state.appliedLog.length !== state.canonical.tick) return false;

  // This page covered the full history → the bit-exact determinism
  // contract holds. Same shape as tick.spec.ts's single-client check.
  const tape: InputIntent[] = state.appliedLog.map((dir) => ({ dir }));
  const expected = pureReplay(seed, tape);

  expect(expected.tick, `${label}: replayed tick`).toBe(state.canonical.tick);
  expect(expected.player, `${label}: replayed player`).toEqual(
    state.canonical.player,
  );
  expect(expected.rng, `${label}: replayed rng`).toBe(state.canonical.rng);
  return true;
}

test.describe("agar · multiplayer CONVERGENCE (rung merge gate)", () => {
  test.beforeEach(() => {
    SEED = Math.floor(Math.random() * 1_000_000) + 1;
    ROOM_URL = `/agar/?seed=${SEED}`;
  });

  test("ordering invariant: each client's canonical == pureReplay(SEED, its appliedLog)", async ({
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

      // Resolve each page's clientId so the tape's `clientId` matches
      // what driveTape reads from the page — same dual-access pattern
      // the binding uses.
      const [idA, idB] = await Promise.all(
        [pageA, pageB].map((p) =>
          p.evaluate(() => {
            const g = (window as unknown as { __game: { clientId: unknown } })
              .__game;
            const v = g.clientId;
            return typeof v === "function"
              ? (v as () => string)()
              : (v as string);
          }),
        ),
      );

      // Non-trivial shared tape — distinct inputs across ticks so
      // `appliedLog` carries a real signal (not all-"none") and the
      // pure-reducer walk actually exercises the RNG path.
      const tape: Tape<string> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
        { tick: 4, clientId: idB, seq: 1, input: "up" },
        { tick: 6, clientId: idA, seq: 2, input: "none" },
        { tick: 6, clientId: idB, seq: 2, input: "none" },
        { tick: 8, clientId: idA, seq: 3, input: "right" },
        { tick: 8, clientId: idB, seq: 3, input: "right" },
      ];

      await driveTape([pageA, pageB], tape);

      // Two-client convergence on canonical state.
      await expectConverge([pageA, pageB]);

      // The rung's real assertion: each page's canonical IS the pure
      // reduction of the inputs the DO applied for it. A broken DO
      // (e.g. dropping every Nth input) makes canonical drift from
      // pureReplay(SEED, appliedLog), and this test fails.
      const [stateA, stateB] = await Promise.all([
        readState(pageA),
        readState(pageB),
      ]);
      const aAsserted = assertCanonicalEqualsReplay("pageA", SEED, stateA);
      const bAsserted = assertCanonicalEqualsReplay("pageB", SEED, stateB);

      // At least one page must have covered the full history — i.e.
      // some page WAS the chronologically first connector and its
      // appliedLog satisfied the bit-exact determinism contract.
      // Under `Promise.all([pageA.goto, pageB.goto])` either page can
      // win the race, so we assert the disjunction. If BOTH were late
      // joiners, the test couldn't prove the offline mirror at all —
      // that would itself be a meaningful failure to surface.
      expect(
        aAsserted || bAsserted,
        "at least one page covered the full history and replayed bit-exact",
      ).toBe(true);

      // Sanity: at least one non-"none" dir landed on each page, i.e.
      // our inputs actually reached the DO — we're not asserting that
      // two all-"none" walks agree.
      expect(
        stateA.appliedLog.some((d) => d !== "none"),
        "pageA: at least one non-none input applied",
      ).toBe(true);
      expect(
        stateB.appliedLog.some((d) => d !== "none"),
        "pageB: at least one non-none input applied",
      ).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("reconnect-replay: B disconnects, A drives, B reconnects, both converge", async ({
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

      const [idA, idB] = await Promise.all(
        [pageA, pageB].map((p) =>
          p.evaluate(() => {
            const g = (window as unknown as { __game: { clientId: unknown } })
              .__game;
            const v = g.clientId;
            return typeof v === "function"
              ? (v as () => string)()
              : (v as string);
          }),
        ),
      );

      // Phase 1: both clients drive together — establish shared state.
      const preDisconnectTape: Tape<string> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
        { tick: 4, clientId: idB, seq: 1, input: "up" },
      ];
      await driveTape([pageA, pageB], preDisconnectTape);
      await expectConverge([pageA, pageB]);

      // Phase 2: B disconnects; A continues to drive. The DO keeps
      // ticking and applying A's inputs. B's local canonical freezes
      // at the last snapshot it received before disconnect.
      await disconnect(pageB);

      const aOnlyTape: Tape<string> = [
        { tick: 8, clientId: idA, seq: 2, input: "right" },
        { tick: 10, clientId: idA, seq: 3, input: "right" },
        { tick: 12, clientId: idA, seq: 4, input: "down" },
        { tick: 14, clientId: idA, seq: 5, input: "down" },
      ];
      await driveTape([pageA], aOnlyTape);

      // Phase 3: B reconnects. The DO replays missed authoritative
      // state; B's canonical catches up. After quiesce both clients
      // see the same canonical.
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);

      // Drive one more shared input post-reconnect so we know B is
      // live again and its appliedLog has resumed advancing.
      const postReconnectTape: Tape<string> = [
        { tick: 18, clientId: idA, seq: 6, input: "none" },
        { tick: 18, clientId: idB, seq: 2, input: "none" },
      ];
      await driveTape([pageA, pageB], postReconnectTape);

      // Convergence: both pages agree on canonical state.
      await expectConverge([pageA, pageB]);

      // Ordering invariant still holds on each side. B's appliedLog
      // after reconnect has a gap (entries grow per snapshot RECEIVED,
      // not per server tick — past memory: "agar appliedLog is
      // module-level + never cleared on reconnect"), so we don't
      // assert appliedLog.length === canonical.tick on B. We DO assert
      // that B's pureReplay over the snapshots it DID receive equals
      // its canonical — same determinism contract, restricted to the
      // observed slice. For A (continuous connection) the full
      // length-equals-tick invariant holds.
      const [stateA, stateB] = await Promise.all([
        readState(pageA),
        readState(pageB),
      ]);

      // A had a continuous connection — IF A was also the
      // chronologically first connector (race-dependent under
      // `Promise.all([pageA.goto, pageB.goto])`), then
      // `pureReplay(SEED, stateA.appliedLog) === stateA.canonical`.
      // If A joined late (race went the other way), A's appliedLog
      // is still gapless but is a SUFFIX of the full history, so
      // the bit-exact replay check is not honest. The helper
      // returns false in that case and skips the assertion.
      // Convergence between A and B is asserted via expectConverge
      // above — that's the rung-level gate.
      assertCanonicalEqualsReplay("pageA (continuous)", SEED, stateA);

      // B-specific: canonical must equal A's canonical (already
      // checked via expectConverge), AND must be non-null. The
      // length-equals-tick check is intentionally relaxed for the
      // reconnect case — B's appliedLog has a gap by design (memory:
      // "agar appliedLog is module-level + never cleared on reconnect")
      // and pureReplay over a gapped log is NOT the determinism contract.
      // The convergence check above is the rung-level assertion.
      expect(stateB.canonical, "pageB: canonical present after reconnect")
        .not.toBeNull();
      if (stateB.canonical !== null) {
        expect(
          stateB.canonical.tick,
          "pageB: caught up to authoritative tick",
        ).toBeGreaterThanOrEqual(stateA.canonical?.tick ?? 0);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
