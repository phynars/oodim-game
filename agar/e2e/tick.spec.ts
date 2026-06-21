import { expect, test } from "@playwright/test";
import {
  pureReplay,
  type InputDir,
  type InputIntent,
  type WorldState,
} from "../server/reducer";

// agar slice 3/4 — authoritative 20Hz tick + snapshot render.
//
// Merge gate: drive a seeded input tape; after N ticks, the DO's
// canonical state (exposed at `window.__game.canonical`) must equal a
// pure offline reducer run over the same ordered inputs + seed.
//
// Deterministic by construction — no `waitForTimeout`. We wait on the
// server's own monotonic `tick` counter to reach the expected target
// before reading the snapshot. The server runs the clock; we just
// observe it.

const SEED = 1234567;

// 36 inputs = 36 ticks of motion. Mix of held directions and pauses
// so the resulting position is non-trivial (not a straight line) and
// the offline reducer's `rng` walk is exercised across "none" ticks
// too.
const TAPE: readonly InputDir[] = [
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

test("agar slice 3 — canonical DO state equals pureReplay(seed, tape)", async ({
  page,
}) => {
  await page.goto(`/?seed=${SEED}`);

  // Wait for the WS to be OPEN (probe.connected flips on `open`).
  await expect(page.getByTestId("agar-net-status")).toHaveAttribute(
    "data-connected",
    "true",
  );

  // Wait for the first snapshot. The DO ticks at 20Hz, so the first
  // snapshot lands within ~50ms of connect — but we don't rely on
  // wall-clock timing; we just poll the probe's tick attribute.
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

  // Send the input tape one entry per server tick. We feed inputs one
  // tick ahead of where we want them applied — when the snapshot for
  // tick T lands, we know the DO is about to start tick T+1, so the
  // next intent we send is the one that gets applied at T+1.
  //
  // The trick: after each `sendInput`, wait for the canonical tick to
  // advance by exactly 1. That synchronises us to the server clock
  // without any waitForTimeout.
  for (let i = 0; i < TAPE.length; i++) {
    const beforeTick = await page.evaluate(
      () => (window as unknown as { __game: { canonical: { tick: number } | null } }).__game.canonical?.tick ?? 0,
    );

    await page.evaluate((dir) => {
      (window as unknown as { __game: { sendInput: (d: string) => void } }).__game.sendInput(dir);
    }, TAPE[i]);

    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              (window as unknown as { __game: { canonical: { tick: number } | null } })
                .__game.canonical?.tick ?? 0,
          ),
        { message: `tick ${beforeTick + 1} from DO` },
      )
      .toBeGreaterThan(beforeTick);
  }

  // The DO has applied at least TAPE.length intents past the first
  // observed tick. Read its current state and compute the offline
  // reducer's expected state from the same seed + tape. They must
  // match bit-exact.
  //
  // Note: the very first observed tick (>0 above) may have been a
  // "none" tick before our first intent landed — so the DO may be one
  // or more ticks ahead of TAPE.length. We don't compare `tick`
  // directly; we compare the terminal POSITION + the RNG state after
  // exactly TAPE.length steps starting from seed.
  const canonical = (await page.evaluate(
    () =>
      (window as unknown as { __game: { canonical: WorldState | null } })
        .__game.canonical,
  )) as WorldState | null;

  expect(canonical).not.toBeNull();
  if (canonical === null) return;

  const tape: InputIntent[] = TAPE.map((dir) => ({ dir }));
  const expected = pureReplay(SEED, tape);

  // The DO may have ticked extra "none" ticks before/after our tape
  // (network jitter on tape start, and at least one trailing tick
  // while we read the final state). The reducer is invariant under
  // trailing "none" ticks for POSITION (motion only happens with a
  // direction), but RNG advances every tick. So:
  //   - position must equal expected.player exactly.
  //   - canonical.tick must be >= expected.tick.
  //   - canonical.rng must equal pureReplay extended with trailing
  //     "none"s up to canonical.tick — i.e. advance the offline
  //     reducer the same extra ticks and re-compare.
  expect(canonical.player).toEqual(expected.player);
  expect(canonical.tick).toBeGreaterThanOrEqual(expected.tick);

  const trailing = canonical.tick - expected.tick;
  const padded = pureReplay(
    SEED,
    tape.concat(
      Array.from({ length: trailing }, () => ({ dir: "none" as const })),
    ),
  );
  expect(canonical.rng).toBe(padded.rng);
  expect(canonical.player).toEqual(padded.player);
});
