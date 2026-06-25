import { expect, test } from "@playwright/test";
import {
  pureReplay,
  type InputDir,
  type ReplayFrame,
  type WorldState,
} from "../server/reducer";

// agar slice 3/4 — authoritative 20Hz tick + snapshot render.
//
// Merge gate: the DO's authoritative state must equal a pure offline
// reducer run over the same seed + the SAME ordered input log the
// server actually applied.
//
// Why we don't try to align "TAPE[i]" to a specific server tick:
//   - The protocol is latest-input-wins. Under CI tick jitter the
//     1:1 mapping from intent-send to tick-slot is inherently racy
//     (sometimes two ticks fire between send and next-snapshot;
//     sometimes the intent arrives in the "wrong" slot).
//   - So instead the server reports the `dir` it applied IN EACH
//     snapshot, the client mirrors them into `window.__game.appliedLog`,
//     and the e2e asserts `pureReplay(seed, appliedLog) === canonical`.
//     That's the actual determinism contract — same seed, same input
//     sequence, same terminal state, bit-exact — and it doesn't care
//     about wire-level timing. The DO clock owns scheduling; we just
//     read what it did and replay it.

const SEED = 1234567;

// Inputs we drive into the DO. Mix of held directions and pauses so
// the resulting state is non-trivial and the RNG walk is exercised
// across "none" ticks too. We don't assume one input lands per tick;
// we just send them with a small pacing gap and let the DO's
// latest-input-wins logic decide what gets applied where.
const INPUTS: readonly InputDir[] = [
  "right", "right", "right", "right", "right",
  "down",  "down",  "down",
  "none",  "none",
  "left",  "left",
  "up",    "up",    "up",
  "right", "right",
  "none",  "none",  "none",
  "down",  "down",  "down",  "down",
  "left",  "left",  "left",
  "none",  "none",
  "right", "right",
  "up",    "up",
  "none",  "none",
];

// How many server ticks we want the DO to have applied before we read
// the state. Server runs at 20Hz (50ms/tick), so 60 ticks ≈ 3s. That's
// well past the ~36 inputs we send, leaving headroom for CI jitter.
const TARGET_TICKS = 60;

test("agar slice 3 — canonical DO state equals pureReplay(seed, appliedLog)", async ({
  page,
}) => {
  // baseURL is `http://localhost:4274/agar/` but vite preview serves
  // the bundle under `base: "/agar/"` — so we must hit `/agar/?seed=…`,
  // not the host root. Use an absolute path here for clarity and
  // immunity to any future baseURL change.
  await page.goto(`/agar/?seed=${SEED}&mp=1`);

  // Wait for the WS to be OPEN.
  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );

  // Wait for the first snapshot so `window.__game.canonical` is defined
  // before we start poking the test surface.
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

  // Feed the inputs. We don't try to one-to-one them with ticks —
  // small pacing gap + latest-input-wins means most distinct inputs
  // get applied to distinct ticks under nominal jitter, and any that
  // get collapsed are still captured correctly in appliedLog. The
  // determinism assertion replays whatever the server saw.
  for (const dir of INPUTS) {
    await page.evaluate((d) => {
      (
        window as unknown as { __game: { sendInput: (x: string) => void } }
      ).__game.sendInput(d);
    }, dir);
    // Tiny pacing gap (~one tick at 20Hz) so the server has a chance
    // to read this intent before we overwrite it with the next. We
    // deliberately don't try to sync to tick boundaries — the merge
    // gate's correctness comes from replaying the SERVER's applied-log,
    // not from one-input-per-tick alignment. State-quiescence is
    // asserted below via expect.poll on appliedLog.length.
    // pacing — human-cadence gap between sendInput calls, not a state wait.
    await page.waitForTimeout(60);
  }

  // Now wait until the DO has ticked enough that we know it's
  // ingested everything we sent. The `dir` field in each snapshot
  // is what was applied that tick, so appliedLog.length === server tick
  // count since connect.
  await expect
    .poll(
      async () =>
        await page.evaluate(
          () =>
            (
              window as unknown as {
                __game: { appliedLog: readonly string[] };
              }
            ).__game.appliedLog.length,
        ),
      {
        message: `DO to apply ${TARGET_TICKS} ticks`,
        timeout: 10_000,
      },
    )
    .toBeGreaterThanOrEqual(TARGET_TICKS);

  // Read the canonical state and the per-tick replay frame log
  // together. The frame log is the server's own record of what it
  // did each tick (joins / leaves / per-id inputs); replaying it
  // must reproduce `canonical` exactly.
  const { canonical, appliedLog, appliedFrames } = (await page.evaluate(() => {
    const g = (
      window as unknown as {
        __game: {
          canonical: WorldState | null;
          appliedLog: readonly InputDir[];
          appliedFrames: readonly ReplayFrame[];
        };
      }
    ).__game;
    return {
      canonical: g.canonical,
      appliedLog: g.appliedLog.slice(),
      appliedFrames: g.appliedFrames.slice(),
    };
  })) as {
    canonical: WorldState | null;
    appliedLog: InputDir[];
    appliedFrames: ReplayFrame[];
  };

  expect(canonical).not.toBeNull();
  if (canonical === null) return;

  // appliedFrames[i] is the ReplayFrame applied at server tick (i+1).
  // The DO initialises at tick=0 and increments inside step(), so the
  // frames length should equal canonical.tick.
  expect(appliedFrames.length).toBe(canonical.tick);

  // Bit-exact determinism check: same seed, same ordered frames →
  // same terminal state.
  const expected = pureReplay(SEED, appliedFrames);

  expect(expected.tick).toBe(canonical.tick);
  expect(expected.players).toEqual(canonical.players);
  expect(expected.rng).toBe(canonical.rng);

  // Sanity: at least ONE non-"none" dir got applied — i.e. our inputs
  // actually reached the DO, we're not just asserting that two
  // all-"none" walks agree.
  expect(appliedLog.some((d) => d !== "none")).toBe(true);
});
