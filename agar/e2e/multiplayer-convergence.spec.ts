// Two-client multiplayer convergence — THE merge gate for #180 / #234.
//
// This spec strengthens `multiplayer-smoke.spec.ts` (which proves only
// "two pages agree with each other") with the strictly stronger
// assertion that one page agrees with the OFFLINE reducer run over
// the server's own applied-input log, AND the second page's view of
// that same log is a consistent SUFFIX of the first page's view.
//
// The asymmetry is deliberate, and Ivy is the reason it's here.
//
// CLIENT-SIDE LOG SEMANTICS (agar/src/main.ts:198 `appliedLog.push`)
//
// `window.__game.appliedLog` grows ONE entry per snapshot the client
// RECEIVES, not per server tick. The DO's `canonical.tick` is the
// absolute server tick. For the first connector A:
//
//   A.appliedLog.length === A.canonical.tick      // A saw tick 1..N
//   pureReplay(SEED, A.appliedLog) === A.canonical
//
// For any later connector B joining mid-match at server tick K:
//
//   B.appliedLog.length   ===  B.canonical.tick - K + 1
//   B.appliedLog          ===  A.appliedLog.slice(K - 1)   // a SUFFIX
//
// You CANNOT assert `pureReplay(SEED, B.appliedLog) === B.canonical`
// — B is missing the prefix [tick 1 .. K-1]. The previous draft of
// this spec did exactly that, and Ivy correctly REQUEST_CHANGES'd it.
//
// SERVER REPLAY STATUS (agar/server/worker.ts)
//
// The slice-3/4 DO has NO per-client input log and NO replay-on-
// reconnect path. The `close` listener just deletes the socket; a
// subsequent `fetch` joins the live broadcast at whatever tick is
// current. So after B disconnects and reconnects, B's post-reconnect
// `appliedLog` is a fresh suffix starting at B's reconnect tick — NOT
// the entire history replayed back. The merge-gate contract this spec
// asserts is therefore the SHARED-PREFIX DELTA between A and B's
// appliedLog views, gated on the only piece that's actually true:
// A's full-history view satisfies `pureReplay(SEED, log) === canonical`.
//
// When the server later grows a per-room ordered input log and replays
// it on reconnect (the real fix for #234), this spec strengthens to
// also assert `pureReplay(SEED, B.appliedLog) === B.canonical` — but
// that change lands on the server side, not here, and not yet.
//
// Scope guardrails (per #234):
//   - Do NOT modify `multiplayer-smoke.spec.ts` — it stays as the
//     binding-loaded floor.
//   - Do NOT widen to food/eat/AoI/leaderboard (agar-04+).
//   - Do NOT mutate `e2e-shared/multiplayer/playwright-binding.ts` or
//     `harness.ts` — `disconnect`, `reconnect`, `readAppliedLog`, and
//     `canonical` are read-only references.
//   - Do NOT add latency assertions (Ivy's axis).
//   - No `waitForTimeout`: every gate is tick-quiesced via the
//     binding's `tickTo` or the existing `data-tick > 0` poll.

import { expect, test, type Page } from "@playwright/test";
import {
  assertClientSurface,
  canonical,
  disconnect,
  driveTape,
  readAppliedLog,
  reconnect,
} from "../../e2e-shared/multiplayer/playwright-binding";
import type { Tape } from "../../e2e-shared/multiplayer/harness";
import {
  pureReplay,
  type InputDir,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

// Numeric seed — `initialState(seed)` normalises via `seed >>> 0`.
// The URL stringifies it; the offline reducer takes the number.
const SEED = 42;
const ROOM_URL = `/agar/?seed=${SEED}`;

// Gate every `goto` on (a) WS handshake complete, (b) at least one
// snapshot from the DO. Mirrors `waitForFirstSnapshot` in the smoke
// spec — duplicated locally per #234's scope (do not mutate the
// smoke file).
async function waitForFirstSnapshot(page: Page): Promise<void> {
  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect
    .poll(
      async () =>
        Number(
          await page.getByTestId("agar-net-status").getAttribute("data-tick"),
        ),
      { message: "first snapshot from DO" },
    )
    .toBeGreaterThan(0);
}

// Read `__game.clientId` via the dual-access pattern the binding
// uses, so tape attribution lines up with what `driveTape` sees.
async function readClientId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const g = (window as unknown as { __game: { clientId: unknown } }).__game;
    const v = g.clientId;
    return typeof v === "function" ? (v as () => string)() : (v as string);
  });
}

// Wait until a page's `__game.tick` reaches `targetTick`. Uses
// expect.poll over the read getter — no wallclock.
async function waitForTick(page: Page, targetTick: number): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = (window as unknown as { __game: { tick: unknown } })
            .__game;
          const v = g.tick;
          return typeof v === "function"
            ? (v as () => number)()
            : (v as number);
        }),
      { message: `tick >= ${targetTick}` },
    )
    .toBeGreaterThanOrEqual(targetTick);
}

// Wait until a page's appliedLog has at least N entries. Used as a
// quiesce signal after disconnect/reconnect — the DO's appliedLog
// grows one element per server tick, so length is a proxy for
// "this client has seen at least N ticks of server state".
async function waitForAppliedLogLength(
  page: Page,
  minLength: number,
): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const g = (
            window as unknown as { __game: { appliedLog: readonly unknown[] } }
          ).__game;
          const v = g.appliedLog;
          const arr =
            typeof v === "function"
              ? (v as () => readonly unknown[])()
              : (v as readonly unknown[]);
          return arr.length;
        }),
      { message: `appliedLog.length >= ${minLength}` },
    )
    .toBeGreaterThanOrEqual(minLength);
}

// Read this page's (canonical, appliedLog) atomically-enough for the
// merge-gate assertions. The harness quiesces both reads on a tick
// boundary; a single-tick read-skew between the two is possible, and
// the callers below account for it explicitly.
async function readPageState(page: Page): Promise<{
  canonical: WorldState;
  appliedLog: readonly InputDir[];
}> {
  const [canon, log] = await Promise.all([
    canonical<WorldState>(page),
    readAppliedLog(page),
  ]);
  expect(canon).not.toBeNull();
  // appliedLog is `readonly InputDir[]` per CLIENT-TEST-SURFACE.md for
  // agar slice 2+.
  return { canonical: canon, appliedLog: log as readonly InputDir[] };
}

// Assert FOR THE FIRST CONNECTOR ONLY: this page saw tick 1 onward,
// so its appliedLog IS the full server history. The DO's reduction
// must match the offline reducer's reduction of that same history.
//
// This is the strongest determinism statement available from any
// single page — but it ONLY holds for a client whose first received
// snapshot was server tick 1 (i.e. the first to join the room). For
// late joiners, see `assertSuffixAgainst`.
function assertFirstConnectorReplay(
  page: { canonical: WorldState; appliedLog: readonly InputDir[] },
): void {
  // First connector: log length must equal absolute server tick.
  // If this fails, either (a) the caller used this on a late joiner
  // (test bug), or (b) the client dropped snapshots (real bug).
  expect(page.appliedLog.length).toBe(page.canonical.tick);

  const tape: InputIntent[] = page.appliedLog.map((dir) => ({ dir }));
  const expected = pureReplay(SEED, tape);

  expect(expected.tick).toBe(page.canonical.tick);
  expect(expected.player).toEqual(page.canonical.player);
  expect(expected.rng).toBe(page.canonical.rng);
}

// Assert: B's appliedLog covers a SUFFIX of A's appliedLog. This is
// the strongest cross-client statement that's honest under the
// slice-3/4 server contract (no per-client replay): both clients see
// the same authoritative stream, B just started observing it K-1
// ticks late.
//
// Alignment is by ABSOLUTE SERVER TICK, not by tail length. The
// previous draft aligned tails by `min(length)`, which silently
// mis-shifted by one whenever A and B's parallel reads landed on
// different server ticks (a tolerated, real read-skew). Aligning by
// `canonical.tick` is the only honest map:
//
//   A's log[i] is absolute tick (i + 1)
//                                 — A is the first connector,
//                                   guaranteed by the caller
//                                   asserting assertFirstConnectorReplay(a)
//                                   first.
//   B's log[j] is absolute tick (lastB - b.length + 1 + j)
//                                 — B may have joined mid-match;
//                                   B's first observed tick is
//                                   (lastB - b.length + 1).
//
// The shared range of absolute ticks both clients observed is
// [firstB, min(lastA, lastB)]. We slice both logs to exactly that
// range and compare element-wise.
function assertBLogIsSuffixOfA(
  a: { canonical: WorldState; appliedLog: readonly InputDir[] },
  b: { canonical: WorldState; appliedLog: readonly InputDir[] },
): void {
  // Caller invariant: assertFirstConnectorReplay(a) has run, which
  // proves a.appliedLog.length === a.canonical.tick — i.e. A's log
  // indexes absolute ticks 1..lastA exactly. This assertion's
  // alignment math depends on that. Re-check here so a misordered
  // caller fails with a precise message, not a silent off-by-one.
  expect(a.appliedLog.length).toBe(a.canonical.tick);

  const lastA = a.canonical.tick;
  const lastB = b.canonical.tick;
  // B's first observed absolute tick. Server ticks are 1-indexed and
  // appliedLog grows one entry per received snapshot, so:
  const firstB = lastB - b.appliedLog.length + 1;

  // B cannot have started observing before tick 1.
  expect(firstB).toBeGreaterThanOrEqual(1);
  // B joined no earlier than A (A was the first connector), so B's
  // first observed tick is >= 1, which we already checked. We do NOT
  // require firstB > 1: in races where A and B handshake within the
  // same server tick boundary, B may also observe tick 1.

  // Allow up to 1 tick of read skew between A and B in EITHER
  // direction — A's reader may catch a snapshot B's hasn't, or vice
  // versa. lastA and lastB are read on separate pages within a
  // single Promise.all, so a 1-tick gap is normal at 20 Hz.
  expect(Math.abs(lastA - lastB)).toBeLessThanOrEqual(1);

  // Shared absolute-tick range — the window both clients observed.
  const sharedStart = firstB;
  const sharedEnd = Math.min(lastA, lastB);
  const sharedLen = sharedEnd - sharedStart + 1;
  expect(sharedLen).toBeGreaterThan(0);

  // A's indices for [sharedStart..sharedEnd] inclusive are
  // [sharedStart-1 .. sharedEnd-1]. Array.slice's end arg is
  // exclusive, hence `sharedEnd` (not sharedEnd - 1 + 1).
  const aSlice = a.appliedLog.slice(sharedStart - 1, sharedEnd);
  // B's indices for the same absolute-tick range are
  // [0 .. sharedEnd - firstB]. Slice end exclusive.
  const bSlice = b.appliedLog.slice(0, sharedEnd - firstB + 1);

  expect(aSlice.length).toBe(sharedLen);
  expect(bSlice.length).toBe(sharedLen);
  expect(bSlice).toEqual(aSlice);
}

test.describe("agar · multiplayer convergence (merge gate for #180)", () => {
  test("A satisfies pureReplay(SEED, log) == canonical; B's log is a suffix of A's", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // SEQUENCE A FIRST so A is the unambiguous first connector — A's
      // appliedLog then includes tick 1 onward and is the full server
      // history. Concurrent `Promise.all([gotoA, gotoB])` races the
      // handshakes and yields a non-deterministic "first connector",
      // which would break `assertFirstConnectorReplay(a)` whenever B
      // wins the race.
      await pageA.goto(ROOM_URL);
      await waitForFirstSnapshot(pageA);
      await assertClientSurface(pageA);

      await pageB.goto(ROOM_URL);
      await waitForFirstSnapshot(pageB);
      await assertClientSurface(pageB);

      const [idA, idB] = await Promise.all([
        readClientId(pageA),
        readClientId(pageB),
      ]);

      // Tape interleaves inputs across both clients. The DO arbitrates
      // (latest-input-wins per tick) and records what it actually
      // applied in appliedLog — that record is what we replay against
      // for A. Tick numbers below are RELATIVE targets the harness's
      // tickTo waits for on the page that owns each event; they don't
      // need to match absolute server ticks.
      const tape: Tape<InputDir> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
        { tick: 4, clientId: idB, seq: 1, input: "up" },
        { tick: 6, clientId: idA, seq: 2, input: "right" },
        { tick: 6, clientId: idB, seq: 2, input: "down" },
        { tick: 8, clientId: idA, seq: 3, input: "up" },
        { tick: 8, clientId: idB, seq: 3, input: "right" },
        { tick: 10, clientId: idA, seq: 4, input: "left" },
        { tick: 10, clientId: idB, seq: 4, input: "up" },
        { tick: 12, clientId: idA, seq: 5, input: "down" },
        { tick: 12, clientId: idB, seq: 5, input: "left" },
        { tick: 14, clientId: idA, seq: 6, input: "none" },
        { tick: 14, clientId: idB, seq: 6, input: "none" },
      ];

      // driveTape signature is (pages, tape, { seed }) per the
      // DriveTape type in harness.ts. The binding ignores the seed
      // for agar (it's already in the URL), but the contract is
      // typed.
      await driveTape([pageA, pageB], tape, { seed: SEED });

      // Quiesce both pages well past the last tape tick. Server runs
      // at 20Hz so 30 ticks ≈ 1.5s — comfortable margin past tick 14.
      await waitForTick(pageA, 30);
      await waitForTick(pageB, 30);

      const a = await readPageState(pageA);
      const b = await readPageState(pageB);

      // Merge gate, part 1: A is the first connector, so A's log is
      // the full server history. The offline reducer applied to that
      // history must reproduce A's canonical state exactly. This is
      // the determinism statement `tick.spec.ts` already asserts for
      // a single client — we're re-asserting it survives the
      // presence of a second connected client.
      assertFirstConnectorReplay(a);

      // Merge gate, part 2: B's log is a SUFFIX of A's. Both clients
      // observed the same DO; B just started observing K-1 ticks
      // late. The tail of B's log must match the corresponding tail
      // of A's log. This is the cross-client convergence statement
      // that's actually true under the slice-3/4 server contract.
      assertBLogIsSuffixOfA(a, b);

      // Sanity: real inputs reached the DO (not an all-"none" walk).
      expect(a.appliedLog.some((d) => d !== "none")).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("after B reconnects mid-match, B's new log is a suffix of A's continuing log", async ({
    browser,
  }) => {
    // What this test does NOT assert (and why):
    //
    // The slice-3/4 DO (agar/server/worker.ts) keeps NO per-client
    // input log and has NO replay-on-reconnect path. The `close`
    // handler just deletes the socket; a subsequent reconnect joins
    // the live broadcast at the current tick. So we cannot assert
    // `pureReplay(SEED, B.appliedLog) === B.canonical` post-reconnect
    // — B's appliedLog is a FRESH suffix starting at the reconnect
    // tick, not a replay of the history B missed.
    //
    // What this test DOES assert is the strongest honest statement
    // under that contract: A's view (continuous, first connector)
    // still satisfies full-history replay, and B's post-reconnect
    // log lines up with the corresponding tail of A's log. If the
    // DO reordered inputs or A's local log diverged from the
    // broadcast, this assertion fails.
    //
    // When the server grows a real replay path (the actual fix for
    // #234), this test strengthens to also assert
    // `pureReplay(SEED, B.appliedLog) === B.canonical`.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // A first, then B — same sequencing reason as test 1: pin A as
      // the unambiguous first connector so A's appliedLog is the full
      // server history.
      await pageA.goto(ROOM_URL);
      await waitForFirstSnapshot(pageA);
      await assertClientSurface(pageA);

      await pageB.goto(ROOM_URL);
      await waitForFirstSnapshot(pageB);
      await assertClientSurface(pageB);

      const [idA, idB] = await Promise.all([
        readClientId(pageA),
        readClientId(pageB),
      ]);

      // Phase 1: both clients drive inputs.
      const phase1: Tape<InputDir> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
        { tick: 4, clientId: idB, seq: 1, input: "up" },
      ];
      await driveTape([pageA, pageB], phase1, { seed: SEED });
      await waitForTick(pageA, 6);
      await waitForTick(pageB, 6);

      // Snapshot B's appliedLog length BEFORE the disconnect. The
      // client's `appliedLog` is a module-level const that is NEVER
      // CLEARED on disconnect/reconnect (see agar/src/main.ts:92 — the
      // appliedLog array outlives the ws and `reconnectWs` just opens
      // a new socket on top of it). So after B reconnects, B's
      // `appliedLog` contains [pre-disconnect entries] + [missed
      // ticks GAP] + [post-reconnect entries]. The contiguous-suffix
      // invariant assertBLogIsSuffixOfA depends on does NOT hold over
      // that gap.
      //
      // To make the suffix comparison honest in this test, we record
      // B's appliedLog length at the moment of disconnect; after
      // reconnect, we slice off the pre-disconnect prefix and assert
      // only on the post-reconnect tail. That tail IS a contiguous
      // run of absolute ticks starting at B's first post-reconnect
      // snapshot — which is exactly the shape assertBLogIsSuffixOfA
      // is contracted against.
      const bAppliedLogLenAtDisconnect = (await readPageState(pageB))
        .appliedLog.length;

      // Cut B's WS — A keeps ticking. The DO must still accept A's
      // inputs and reflect them in its broadcast (and therefore in
      // A's local appliedLog).
      await disconnect(pageB);

      const phase2_AOnly: Tape<InputDir> = [
        { tick: 8, clientId: idA, seq: 2, input: "up" },
        { tick: 10, clientId: idA, seq: 3, input: "right" },
        { tick: 12, clientId: idA, seq: 4, input: "down" },
        { tick: 14, clientId: idA, seq: 5, input: "left" },
      ];
      await driveTape([pageA], phase2_AOnly, { seed: SEED });
      await waitForTick(pageA, 16);

      // B reconnects. Under the slice-3/4 contract, B will start
      // receiving NEW snapshots at the current server tick — there's
      // no replay. We wait for B's appliedLog to grow at least one
      // entry (proving the new ws is healthy and snapshots are
      // flowing), then a small further quiesce so B and A's reads
      // sit close in wallclock.
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);
      await waitForAppliedLogLength(pageB, 1);

      // Let a few more snapshots flow so B's post-reconnect tail has
      // enough length to make the suffix assertion non-trivial.
      const bTickAfterReconnect = await pageB.evaluate(() => {
        const g = (window as unknown as { __game: { tick: unknown } }).__game;
        const v = g.tick;
        return typeof v === "function"
          ? (v as () => number)()
          : (v as number);
      });
      await waitForTick(pageA, bTickAfterReconnect + 6);
      await waitForTick(pageB, bTickAfterReconnect + 6);

      const a = await readPageState(pageA);
      const bFull = await readPageState(pageB);

      // A is still the first connector and was never disconnected —
      // A's log remains the full server history and must still
      // satisfy the offline-reducer determinism contract.
      assertFirstConnectorReplay(a);

      // Slice off B's pre-disconnect entries. The remaining tail is a
      // contiguous run of absolute ticks starting at B's first
      // post-reconnect snapshot — the shape assertBLogIsSuffixOfA
      // expects. The synthetic `canonical.tick` we pass through is
      // B's current real tick (the post-reconnect tail ends at that
      // tick), and the synthetic appliedLog length matches that
      // tail's length so the (firstB = lastB - length + 1) formula
      // inside the assertion points at the right absolute tick.
      const bPostReconnectLog = bFull.appliedLog.slice(
        bAppliedLogLenAtDisconnect,
      );
      expect(bPostReconnectLog.length).toBeGreaterThan(0);
      const bForSuffix = {
        canonical: bFull.canonical,
        appliedLog: bPostReconnectLog,
      };

      // B's post-reconnect log MUST be a suffix of A's log. If the
      // DO reordered or A's recv-order doesn't match the broadcast
      // order, the tails diverge and this fails.
      assertBLogIsSuffixOfA(a, bForSuffix);

      // Sanity: B was actually disconnected during phase 2 — its
      // post-reconnect tail must be strictly shorter than A's full
      // log. If they're equal, B somehow kept up through the gap
      // (test bug — the disconnect didn't take).
      expect(bPostReconnectLog.length).toBeLessThan(a.appliedLog.length);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
