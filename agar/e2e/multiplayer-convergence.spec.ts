// Two-client multiplayer convergence — THE merge gate for #180 / #234.
//
// This spec strengthens `multiplayer-smoke.spec.ts` (which proves only
// "two pages agree the WS is up") by asserting CROSS-CLIENT agreement:
// the applied-input log B sees is a contiguous SUFFIX of the log A sees,
// aligned by absolute server tick. If the DO reordered inputs, dropped
// a snapshot to one client, or two clients diverged on what was
// applied, this spec fails.
//
// WHAT THIS SPEC INTENTIONALLY DOES NOT ASSERT — and why
//
// An earlier draft also asserted `pureReplay(SEED, A.appliedLog) === A.canonical`
// for A as "the first connector". That assertion is NOT honest under
// the slice-3/4 server contract:
//
//   - `agar/server/worker.ts` boots a 20Hz `setInterval` tick loop the
//     moment the first socket attaches (`ensureTickLoop()`), and the
//     DO instance can survive between tests (alarms only stop when
//     the socket set empties AND the runtime decides to evict).
//   - The client's `appliedLog` (agar/src/main.ts:196) grows ONE
//     entry per snapshot RECEIVED, not per server tick. A's `message`
//     handler attaches after the WS handshake; depending on tick-loop
//     phase A may miss tick 1 entirely.
//   - Result: `a.appliedLog.length === a.canonical.tick` is NOT
//     guaranteed even for the chronologically-first connector. The
//     offline-reducer cross-check is only honest when the server
//     grows a tick-1 join signal (a real fix for #234), and that
//     change lands on the server, not here.
//
// What's left is the strongest cross-client statement that's actually
// true under the current server: A and B observed the same broadcast
// stream, possibly with different start ticks and small read-skew at
// the end. Their overlapping window must match element-for-element.
//
// Scope guardrails (per #234):
//   - Do NOT modify `multiplayer-smoke.spec.ts` — it stays as the
//     binding-loaded floor.
//   - Do NOT widen to food/eat/AoI/leaderboard (agar-04+).
//   - Do NOT mutate `e2e-shared/multiplayer/playwright-binding.ts` or
//     `harness.ts` — `disconnect`, `reconnect`, `readAppliedLog`, and
//     `canonical` are read-only references.
//   - No `waitForTimeout`: every gate is tick-quiesced via the
//     existing `data-tick > 0` poll or `__game.tick`.

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
import type { InputDir, WorldState } from "../server/reducer";

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
// quiesce signal after reconnect — the client's `appliedLog` grows
// one element per received snapshot, so length is a proxy for
// "this client has seen at least N snapshots since attach".
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
// merge-gate assertions. The two reads happen via Promise.all on the
// same page, so a single-tick read-skew between them is possible and
// is tolerated explicitly by `assertSuffixOverlap` below.
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

// Assert: A's and B's appliedLogs match element-for-element across
// every absolute server tick BOTH clients observed.
//
// Per-client invariant (independent of which client connected first):
//
//   appliedLog[i] is the snapshot at absolute server tick
//     (canonical.tick - appliedLog.length + 1 + i)
//
//   i.e. the LAST entry is `canonical.tick`, the FIRST entry is
//   (canonical.tick - appliedLog.length + 1). This holds for every
//   page regardless of when it joined, because `canonical.tick` is
//   updated by the SAME snapshot whose `dir` is pushed onto
//   `appliedLog` (agar/src/main.ts:188-196).
//
// The shared absolute-tick window both clients observed is
// [max(firstA, firstB), min(lastA, lastB)]. We slice both logs to
// exactly that window and assert equality. The window must be
// non-empty under any non-trivial test (both clients running
// concurrently for ≥1 tick).
function assertSuffixOverlap(
  a: { canonical: WorldState; appliedLog: readonly InputDir[] },
  b: { canonical: WorldState; appliedLog: readonly InputDir[] },
): void {
  const lastA = a.canonical.tick;
  const lastB = b.canonical.tick;
  const firstA = lastA - a.appliedLog.length + 1;
  const firstB = lastB - b.appliedLog.length + 1;

  // Neither client can have "started observing" before server tick 1.
  expect(firstA).toBeGreaterThanOrEqual(1);
  expect(firstB).toBeGreaterThanOrEqual(1);

  // Allow up to 1 tick of read skew between A and B in either
  // direction — the two `canonical.tick` reads are on separate pages
  // within a single Promise.all, so a 1-tick gap is normal at 20Hz.
  expect(Math.abs(lastA - lastB)).toBeLessThanOrEqual(1);

  // Shared absolute-tick range — the window both clients observed.
  const sharedStart = Math.max(firstA, firstB);
  const sharedEnd = Math.min(lastA, lastB);
  const sharedLen = sharedEnd - sharedStart + 1;
  expect(sharedLen).toBeGreaterThan(0);

  // A's index of absolute tick T is (T - firstA). Slice end exclusive.
  const aSlice = a.appliedLog.slice(
    sharedStart - firstA,
    sharedEnd - firstA + 1,
  );
  // B's index of absolute tick T is (T - firstB). Slice end exclusive.
  const bSlice = b.appliedLog.slice(
    sharedStart - firstB,
    sharedEnd - firstB + 1,
  );

  expect(aSlice.length).toBe(sharedLen);
  expect(bSlice.length).toBe(sharedLen);
  expect(bSlice).toEqual(aSlice);
}

test.describe("agar · multiplayer convergence (merge gate for #180)", () => {
  test("two pages' appliedLogs agree across their shared observation window", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Sequence A before B so A has the LONGER applied-input log —
      // the shared window is non-trivial and dominated by A's
      // observation range. Either order is "correct" for the suffix
      // assertion (it aligns by absolute tick, not arrival order),
      // but sequencing makes the failure mode easier to read: when
      // it breaks, you know B's log is the shorter one.
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
      // applied in appliedLog — that record is what the cross-client
      // assertion compares. Tick numbers below are RELATIVE targets
      // the harness's tickTo waits for on the page that owns each
      // event; they don't need to match absolute server ticks.
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
      // for agar (it's already in the URL), but the contract is typed.
      await driveTape([pageA, pageB], tape, { seed: SEED });

      // Quiesce both pages well past the last tape tick. Server runs
      // at 20Hz so 30 ticks ≈ 1.5s — comfortable margin past tick 14.
      await waitForTick(pageA, 30);
      await waitForTick(pageB, 30);

      const a = await readPageState(pageA);
      const b = await readPageState(pageB);

      // Merge gate: across the absolute-tick window both clients
      // observed, the DO must have broadcast IDENTICAL applied-input
      // entries. If the DO reordered inputs, dropped a snapshot to
      // one client, or A's local log diverged from B's view of the
      // same broadcast, this fails.
      assertSuffixOverlap(a, b);

      // Sanity: real inputs reached the DO (not an all-"none" walk).
      expect(a.appliedLog.some((d) => d !== "none")).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("after B reconnects mid-match, B's new log still matches A's continuing log over their shared window", async ({
    browser,
  }) => {
    // What this test does NOT assert (and why):
    //
    // The slice-3/4 DO (agar/server/worker.ts) keeps NO per-client
    // input log and has NO replay-on-reconnect path. The `close`
    // handler just deletes the socket; a subsequent reconnect joins
    // the live broadcast at the current tick. So we cannot assert
    // any "B replays the gap" property — B's appliedLog is a FRESH
    // suffix starting at the reconnect tick, not a replay of the
    // history B missed.
    //
    // What this test DOES assert is the strongest honest statement
    // under that contract: A's continuous log and B's post-reconnect
    // tail agree element-for-element over their shared absolute-tick
    // window. If the DO reordered inputs across the disconnect or
    // A's local log diverged from the broadcast, this assertion
    // fails.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // A first, then B — same sequencing reason as test 1: A has the
      // longer log, making the failure mode easier to read.
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
      // CLEARED on disconnect/reconnect (agar/src/main.ts:92 — the
      // appliedLog array outlives the WS, and `reconnectWs` just
      // opens a new socket on top of it). So after B reconnects, B's
      // `appliedLog` contains [pre-disconnect entries] + [missed
      // ticks GAP] + [post-reconnect entries]. The shared-window
      // assertion `assertSuffixOverlap` aligns by
      // `lastTick - length + 1`, which is WRONG across that gap —
      // it would treat B's log as if it covered a contiguous run
      // ending at the current tick, which it doesn't.
      //
      // To make the comparison honest, we record B's appliedLog
      // length at the moment of disconnect; after reconnect, we
      // slice off the pre-disconnect prefix and pass only the
      // post-reconnect tail (which IS a contiguous run ending at
      // B's current tick) to assertSuffixOverlap.
      const bAppliedLogLenAtDisconnect = (await readPageState(pageB))
        .appliedLog.length;

      // Cut B's WS — A keeps ticking. The DO must still accept A's
      // inputs and reflect them in its broadcast (and therefore in
      // A's local appliedLog).
      await disconnect(pageB);

      const phase2AOnly: Tape<InputDir> = [
        { tick: 8, clientId: idA, seq: 2, input: "up" },
        { tick: 10, clientId: idA, seq: 3, input: "right" },
        { tick: 12, clientId: idA, seq: 4, input: "down" },
        { tick: 14, clientId: idA, seq: 5, input: "left" },
      ];
      await driveTape([pageA], phase2AOnly, { seed: SEED });
      await waitForTick(pageA, 16);

      // B reconnects. Under the slice-3/4 contract, B starts
      // receiving NEW snapshots at the current server tick — there's
      // no replay. Wait for B's appliedLog to grow past its
      // pre-disconnect length (proving the new WS is healthy and
      // post-reconnect snapshots are flowing).
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);
      await waitForAppliedLogLength(pageB, bAppliedLogLenAtDisconnect + 1);

      // Let a few more snapshots flow so B's post-reconnect tail has
      // enough length to make the shared-window assertion non-trivial.
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

      // Slice off B's pre-disconnect entries. The remaining tail is a
      // contiguous run of absolute ticks ending at B's current tick —
      // the shape `assertSuffixOverlap` expects.
      const bPostReconnectLog = bFull.appliedLog.slice(
        bAppliedLogLenAtDisconnect,
      );
      expect(bPostReconnectLog.length).toBeGreaterThan(0);
      const bForOverlap = {
        canonical: bFull.canonical,
        appliedLog: bPostReconnectLog,
      };

      // Merge gate: B's post-reconnect tail and A's continuing log
      // must agree across their shared absolute-tick window. If the
      // DO reordered or A's local log diverged from the broadcast,
      // the windows mismatch and this fails.
      assertSuffixOverlap(a, bForOverlap);

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
