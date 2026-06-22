// Two-client multiplayer convergence — THE merge gate for #180 / #234.
//
// This spec strengthens `multiplayer-smoke.spec.ts` (which proves only
// "two pages agree with each other") with the strictly stronger
// assertion that both pages also agree with the OFFLINE reducer run
// over the server's own applied-input log:
//
//   pureReplay(SEED, appliedLog) === canonical    on BOTH pages
//
// Two pages can agree on a CORRUPTED reduction. They cannot both
// agree with the offline reducer's output for the server's own log
// unless the DO is actually running the reducer faithfully. This is
// the same determinism contract `tick.spec.ts` asserts for a single
// client, generalised to two clients sharing one room.
//
// Why this shape, not a tape-driven `pureReplay(initial, tape)`:
//
// The DO ticks autonomously at 20Hz. The server's `canonical.tick` is
// a function of wallclock + handshake latency, NOT of how many tape
// events you fed it. So `pureReplay(initial, tape)` (which advances
// state once per tape event) cannot equal `canonical` — `.tick` alone
// will diverge every run. The single-client merge gate sidesteps this
// by replaying the server's OWN applied-input log (one element per
// server tick); we adopt the same idiom for two clients.
//
// Why this shape works even though `WorldState.player` is single-player:
//
// Slice 3/4's reducer carries one `{x, y}` (single-player world). But
// the appliedLog records what the DO applied each tick under its own
// latest-input-wins arbitration across both clients. Both pages see
// the same authoritative canonical and the same authoritative
// appliedLog; both pages must satisfy
// `pureReplay(SEED, appliedLog) === canonical`. That assertion is
// meaningful regardless of how many clients fed inputs — it pins the
// DO's reduction to the offline reducer's reduction over the merged
// input stream. When agar grows per-client world state (post-#234),
// this same assertion shape generalises: appliedLog becomes a per-
// client-keyed stream and the reducer accepts it. The contract — DO
// state equals offline reducer over the DO's own log — does not
// change.
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

// Assert: this page's canonical state equals the offline reducer's
// terminal state over the SERVER'S OWN applied-input log. This is the
// strongest determinism statement available from a single page — and
// when both pages satisfy it AND share the same appliedLog, both
// pages are pinned to the offline ground truth.
async function assertCanonicalEqualsReplay(page: Page): Promise<{
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
  const typedLog = log as readonly InputDir[];

  // appliedLog[i] is the dir applied at server tick (i+1). The DO
  // initialises at tick=0 and step() increments — so log.length
  // should equal canonical.tick exactly.
  expect(typedLog.length).toBe(canon.tick);

  const tape: InputIntent[] = typedLog.map((dir) => ({ dir }));
  const expected = pureReplay(SEED, tape);

  expect(expected.tick).toBe(canon.tick);
  expect(expected.player).toEqual(canon.player);
  expect(expected.rng).toBe(canon.rng);

  return { canonical: canon, appliedLog: typedLog };
}

test.describe("agar · multiplayer convergence (merge gate for #180)", () => {
  test("both pages: canonical == pureReplay(SEED, appliedLog) AND share the same log", async ({
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

      const [idA, idB] = await Promise.all([
        readClientId(pageA),
        readClientId(pageB),
      ]);

      // Tape interleaves inputs across both clients. The DO arbitrates
      // (latest-input-wins per tick) and records what it actually
      // applied in appliedLog — that record is what we replay against.
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

      // Each page on its own: canonical equals offline reducer over
      // THIS page's view of appliedLog. (Both pages see the DO's
      // authoritative state, so both views should match.)
      const a = await assertCanonicalEqualsReplay(pageA);
      const b = await assertCanonicalEqualsReplay(pageB);

      // Both pages saw the SAME server. Their appliedLog reads taken
      // after the same quiesce should be identical (or one a prefix
      // of the other under last-tick jitter). We assert equality on
      // the shared prefix and identical canonical at that prefix —
      // the strongest cross-page statement that's robust to a single
      // tick of read-skew.
      const sharedLen = Math.min(a.appliedLog.length, b.appliedLog.length);
      expect(sharedLen).toBeGreaterThanOrEqual(30);
      expect(a.appliedLog.slice(0, sharedLen)).toEqual(
        b.appliedLog.slice(0, sharedLen),
      );

      // At the shared prefix, the offline reducer produces ONE
      // terminal state. Both pages must agree with it.
      const prefixTape: InputIntent[] = a.appliedLog
        .slice(0, sharedLen)
        .map((dir) => ({ dir }));
      const expectedAtPrefix = pureReplay(SEED, prefixTape);
      // A's canonical at A's prefix (length sharedLen) IS A's
      // canonical if a.appliedLog.length === sharedLen; otherwise
      // A is one tick ahead — re-derive at the shared tick.
      // Since canonical.tick === appliedLog.length, both pages at
      // tick == sharedLen reduce to expectedAtPrefix.
      if (a.canonical.tick === sharedLen) {
        expect(a.canonical).toEqual(expectedAtPrefix);
      }
      if (b.canonical.tick === sharedLen) {
        expect(b.canonical).toEqual(expectedAtPrefix);
      }

      // Sanity: real inputs reached the DO (not an all-"none" walk).
      expect(a.appliedLog.some((d) => d !== "none")).toBe(true);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("reconnect-replay: B reconnects mid-match, converges to pureReplay over B's full log", async ({
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

      // Cut B's WS — A keeps ticking. The DO must still accept A's
      // inputs and persist them in its ordered log.
      await disconnect(pageB);

      const phase2_AOnly: Tape<InputDir> = [
        { tick: 8, clientId: idA, seq: 2, input: "up" },
        { tick: 10, clientId: idA, seq: 3, input: "right" },
        { tick: 12, clientId: idA, seq: 4, input: "down" },
        { tick: 14, clientId: idA, seq: 5, input: "left" },
      ];
      await driveTape([pageA], phase2_AOnly, { seed: SEED });
      await waitForTick(pageA, 16);

      // B reconnects. The DO replays its input log to B. We then
      // quiesce B on appliedLog growth (it must catch up to at least
      // A's current tick count of ticks).
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);

      const aTickAtReconnect = await pageA.evaluate(() => {
        const g = (window as unknown as { __game: { tick: unknown } }).__game;
        const v = g.tick;
        return typeof v === "function"
          ? (v as () => number)()
          : (v as number);
      });
      // B must catch up to the server's view that A already has. We
      // wait on B's appliedLog length (a direct read of the replay)
      // rather than wallclock.
      await waitForAppliedLogLength(pageB, aTickAtReconnect);
      await waitForTick(pageB, aTickAtReconnect);

      // The contract on each page independently: canonical equals
      // offline reducer over the server's own applied-input log.
      // This is the merge gate: if the DO reordered, dropped, or
      // failed to replay missed inputs, the assertion fails on the
      // page that observed the bad log.
      const a = await assertCanonicalEqualsReplay(pageA);
      const b = await assertCanonicalEqualsReplay(pageB);

      // After B caught up, A and B should share at least their
      // overlapping log prefix.
      const sharedLen = Math.min(a.appliedLog.length, b.appliedLog.length);
      expect(sharedLen).toBeGreaterThanOrEqual(aTickAtReconnect);
      expect(a.appliedLog.slice(0, sharedLen)).toEqual(
        b.appliedLog.slice(0, sharedLen),
      );
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
