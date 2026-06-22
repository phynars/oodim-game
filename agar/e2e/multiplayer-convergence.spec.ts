// Two-client multiplayer convergence — THE merge gate for #180 / #234.
//
// What this spec proves (and what the landed `multiplayer-smoke.spec.ts`
// does NOT):
//
//   1. ORDERING INVARIANT — `__game.canonical` on both pages equals
//      the offline reducer's terminal state for the same tape under
//      SEED, structural equality. Names the rung's contract: canonical
//      state IS the deterministic reduction of the ordered input log.
//      A two-client test that would pass on a single client is not a
//      multiplayer test (see #234).
//
//   2. RECONNECT-REPLAY — disconnect page B mid-tape, drive more inputs
//      on A only, reconnect B, wait for WS quiesce, then assert B's
//      canonical equals A's equals the offline reducer's output for
//      the FULL tape under SEED. The DO must replay missed inputs in
//      the original order from its log, not from B's local view.
//
//   3. ZERO `waitForTimeout` — every gate is tick-quiesced via the
//      binding's `tickTo` or the existing `data-tick > 0` poll. This
//      file must contain no wallclock waits. `grep waitForTimeout` on
//      this path returns no matches.
//
// Follow-up (NOT in this PR):
//   The DESYNC_BROKEN=1 red/green CI job — a workflow that builds the
//   agar Worker twice (DO drops every 7th input vs. main) and asserts
//   this suite goes RED under the broken build, GREEN against main —
//   is the Phoenix-hole-closer. It is filed separately. This spec is
//   the assertion shape that job will invoke; landing the workflow
//   without the spec made no sense, but landing the spec without the
//   workflow is still a strict improvement over only the smoke floor.
//
// Scope guardrails (per #234):
//   - Do NOT modify `multiplayer-smoke.spec.ts` — it stays as the
//     binding-loaded floor.
//   - Do NOT widen to food/eat/AoI/leaderboard (agar-04+).
//   - Do NOT mutate `e2e-shared/multiplayer/playwright-binding.ts` or
//     `harness.ts` — they are read-only references; `disconnect`,
//     `reconnect`, and the generic harness `pureReplay` already exist.
//   - Do NOT add latency assertions (Ivy's axis).

import { expect, test, type Page } from "@playwright/test";
import {
  assertClientSurface,
  canonical,
  disconnect,
  driveTape,
  reconnect,
} from "../../e2e-shared/multiplayer/playwright-binding";
import {
  pureReplay,
  type Reducer,
  type Tape,
} from "../../e2e-shared/multiplayer/harness";
import {
  initialState,
  step,
  type InputDir,
  type WorldState,
} from "../server/reducer";

// Seed for the match. Numeric — the agar reducer's `initialState(seed)`
// requires a number (it normalises via `seed >>> 0`). The room URL still
// carries a stringified copy because URLs are strings.
const SEED = 42;

// Adapter: the harness `pureReplay` is generic over (state, input,
// reducer). The agar reducer's `step` expects `{dir: InputDir}`; our
// tape carries the bare `InputDir` string (matching what the agar client
// ships through `__game.sendInput`). The adapter wraps each tape event's
// input into the `{dir}` shape `step` consumes.
const agarReducer: Reducer<WorldState, InputDir> = (prev, ev) =>
  step(prev, { dir: ev.input });

function replayAgar(tape: Tape<InputDir>): WorldState {
  return pureReplay<WorldState, InputDir>(initialState(SEED), tape, agarReducer);
}
// `base: "/agar/"` under vite preview — hitting host root 404s and
// `__game` never installs. Same trap documented in tick.spec.ts and
// multiplayer-smoke.spec.ts.
const ROOM_URL = `/agar/?seed=${SEED}`;

// Gate every `goto` on (a) WS handshake complete, (b) at least one
// snapshot from the DO. Mirrors `waitForFirstSnapshot` in the smoke
// spec — duplicated locally to keep the smoke file untouched per
// #234's scope.
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

// Read `__game.clientId` via the dual access pattern (`value | () =>
// value`) the binding's `driveTape` uses, so tape attribution lines up
// with what the page sees.
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
          return typeof v === "function" ? (v as () => number)() : (v as number);
        }),
      { message: `tick >= ${targetTick}` },
    )
    .toBeGreaterThanOrEqual(targetTick);
}

test.describe("agar · multiplayer convergence (merge gate for #180)", () => {
  test("ordering invariant: both pages' canonical equals pureReplay(tape, SEED)", async ({
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

      // Tape with enough ordered inputs that a DO which silently
      // re-orders OR drops any input will diverge from `pureReplay`.
      // Spans across ticks 2..14 with interleaved client inputs so
      // that "every 7th input dropped" (DESYNC_BROKEN=1) collides with
      // a real game-state input, not a no-op.
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

      await driveTape([pageA, pageB], tape);

      // The contract: each page's `canonical` must structurally equal
      // the offline reducer's output for this tape under SEED. Two
      // pages agreeing with EACH OTHER is necessary but not sufficient
      // — they could agree on a corrupted reduction. They must agree
      // with the offline reducer's terminal state — the ground truth.
      const expected = replayAgar(tape);
      const [canonA, canonB] = await Promise.all([
        canonical(pageA),
        canonical(pageB),
      ]);
      expect(canonA).toEqual(expected);
      expect(canonB).toEqual(expected);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("reconnect-replay: B reconnects mid-tape, converges to pureReplay(fullTape, SEED)", async ({
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

      // Tape splits at tick 6: phase 1 with both clients, then B
      // disconnects, phase 2 (A only) drives more inputs, then B
      // reconnects and must catch up via the DO's input log replay.
      const phase1: Tape<InputDir> = [
        { tick: 2, clientId: idA, seq: 0, input: "right" },
        { tick: 2, clientId: idB, seq: 0, input: "left" },
        { tick: 4, clientId: idA, seq: 1, input: "down" },
        { tick: 4, clientId: idB, seq: 1, input: "up" },
      ];
      const phase2_AOnly: Tape<InputDir> = [
        { tick: 6, clientId: idA, seq: 2, input: "up" },
        { tick: 8, clientId: idA, seq: 3, input: "right" },
        { tick: 10, clientId: idA, seq: 4, input: "down" },
        { tick: 12, clientId: idA, seq: 5, input: "left" },
      ];
      const fullTape: Tape<InputDir> = [...phase1, ...phase2_AOnly];

      await driveTape([pageA, pageB], phase1);

      // Cut B's WS — A keeps ticking. The DO must still accept A's
      // inputs and persist them in its ordered log.
      await disconnect(pageB);
      await driveTape([pageA], phase2_AOnly);
      await waitForTick(pageA, 12);

      // B reconnects. The DO replays its input log; B's canonical
      // converges. No wallclock here — `reconnect` resolves when the
      // handshake completes, and we then poll on tick to confirm B
      // has consumed the replay.
      await reconnect(pageB);
      await waitForFirstSnapshot(pageB);
      await waitForTick(pageB, 12);

      const expected = replayAgar(fullTape);
      const [canonA, canonB] = await Promise.all([
        canonical(pageA),
        canonical(pageB),
      ]);
      expect(canonA).toEqual(expected);
      expect(canonB).toEqual(expected);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
