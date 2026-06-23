// agar — persistence harness contract (issue #307).
//
// Three tests. ONE unskipped (the file-time merge gate); TWO skipped
// behind issue-anchored reasons so slices 1 and 3 unskip them as their
// respective gate closures. Same shape as the multiplayer harness
// (#234) and the balance harness (#303).
//
// Why this file exists BEFORE the persistence slices land:
//   The slice-3 e2e (`persistence-survives-eviction.spec.ts`) is a
//   single happy-path assertion. A green happy-path can coexist with
//   a non-monotone or lossy storage layer — the bug only shows up
//   under adversarial input ordering or after multiple evictions.
//   This harness captures those invariants as separate tests with
//   their own polarity, so the implementer cannot ship a weaker gate
//   ad-hoc.
//
// The two skipped tests cite the slice that owns their unskip in the
// skip reason. Search for "unskipped by agar persistence slice" to
// find them when picking up that slice.

import { test, expect } from "@playwright/test";
import { parseBreakMode, BREAK_MODES } from "../server/worker";
import { PLAYER_MASS_START } from "../server/reducer";

// Worker dev host — agar's DO + WS endpoint runs on a separate
// process from the Vite preview that hosts the page. Same host the
// agar client connects to (see `agar/src/main.ts` wsUrl).
const WORKER_BASE = "http://localhost:8787";

test.describe("agar persistence harness contract (#307)", () => {
  test("break-mode-parse — worker accepts the two persistence break modes", () => {
    // File-time merge gate. Proves the worker's BREAK_MODES literal
    // union has been extended for the persistence epic. Polarity:
    // removing either entry from `BREAK_MODES` in worker.ts makes
    // this test RED (parseBreakMode throws on unknown modes per
    // #276 AC4). That is the self-test required by #307's polarity
    // discipline section.
    expect(BREAK_MODES.has("lossy-persist")).toBe(true);
    expect(BREAK_MODES.has("non-monotone-persist")).toBe(true);

    expect(parseBreakMode("lossy-persist")).toBe("lossy-persist");
    expect(parseBreakMode("non-monotone-persist")).toBe("non-monotone-persist");

    // Negative side of the polarity: an unknown mode must still
    // throw — this is the property #276 AC4 locks in, and the
    // persistence epic must not weaken it.
    expect(() => parseBreakMode("not-a-real-mode")).toThrow();

    // Default (env unset / empty) still parses to null.
    expect(parseBreakMode(undefined)).toBeNull();
    expect(parseBreakMode("")).toBeNull();
  });

  test("monotonic-persist — a lower score never overwrites a higher one", async ({
    browser,
  }) => {
    // Fixed seed (not a random-per-test seed). Persistence is keyed
    // by seed → DO id, and we need the SAME DO to see A's high write
    // and then B's lower-score attempt. A random seed would still
    // work in a single test run, but a fixed seed keeps the failure
    // trail reproducible if this ever flakes.
    const SEED = 7319;
    const ROOM_URL = `/agar/?seed=${SEED}`;
    const TOP_SCORE_URL = `${WORKER_BASE}/__test/top-score?seed=${SEED}`;

    // --- Phase 1: drive playerA, sweep bestMass above PLAYER_MASS_START.
    //
    // The agar reducer grows bestMass via pellet eats (each eaten
    // pellet adds 1 to mass; bestMass tracks the max). FOOD_COUNT=40
    // pellets sit in a 640×640 world; the player moves at SPEED=4
    // px/tick with PLAYER_R≈16. Driving directional motion for ~80
    // ticks (4s at 20Hz) sweeps a long enough path to hit several
    // pellets across the random spawn position — the assertion below
    // is `bestMass > PLAYER_MASS_START`, which only needs ONE eat.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    let high = 0;
    try {
      await pageA.goto(ROOM_URL);
      await expect(pageA.getByTestId("agar-net-status")).toHaveAttribute(
        "data-connected",
        "true",
      );
      await expect
        .poll(
          async () =>
            Number(
              await pageA
                .getByTestId("agar-net-status")
                .getAttribute("data-tick"),
            ),
          { message: "first snapshot from DO (pageA)" },
        )
        .toBeGreaterThan(0);

      // Drive a varied input pattern so the player crosses pellet
      // bands in both axes. Walking 20 ticks each in two directions
      // sweeps ~80 px per direction — comfortably wider than the
      // ~80px-spaced pellet grid means an eat is statistically
      // overdetermined within the test window.
      const dirs: Array<"right" | "down" | "left" | "up"> = [
        "right",
        "down",
        "left",
        "up",
      ];
      for (const dir of dirs) {
        await pageA.evaluate((d: string) => {
          const w = window as unknown as {
            __game: { sendInput: (i: string) => void };
          };
          w.__game.sendInput(d);
        }, dir);
        // Tick to current+20 — pure tick advance, no wallclock.
        await pageA.evaluate(() => {
          const w = window as unknown as {
            __game: {
              tick: number | (() => number);
              tickTo: (n: number) => Promise<void>;
            };
          };
          const tf = w.__game.tick;
          const cur = typeof tf === "function" ? tf() : tf;
          return w.__game.tickTo(cur + 20);
        });
      }

      // Capture the high-water mark: max bestMass across the roster.
      // With one player (A) connected, this equals A's bestMass.
      high = await pageA.evaluate(() => {
        const w = window as unknown as {
          __game: {
            canonical: {
              players: Array<{ bestMass: number }>;
            } | null;
          };
        };
        const c = w.__game.canonical;
        if (c === null) return 0;
        let max = 0;
        for (const p of c.players) {
          if (p.bestMass > max) max = p.bestMass;
        }
        return max;
      });

      // Gate the test honestly: the polarity assertion is only
      // meaningful if A actually grew bestMass above the floor. If
      // this fires, the food-eat sweep didn't land — that's a real
      // problem (spawn-pellet geometry regression OR a ticking
      // regression), not a flake to retry.
      expect(
        high,
        "playerA bestMass swept above PLAYER_MASS_START (pellet eats landed)",
      ).toBeGreaterThan(PLAYER_MASS_START);
    } finally {
      // Close pageA's context — drops the WS, fires the leaves frame
      // on the DO. After the leaves frame is applied next tick, the
      // roster is empty and currentTopScore() drops to 0. The
      // monotone guard in persistTopScore is the ONLY thing
      // protecting the persisted `topScore` from being overwritten
      // when a fresh player joins with bestMass=PLAYER_MASS_START.
      await ctxA.close();
    }

    // --- Phase 2: open playerB with a FRESH browser context (fresh
    // cid). B joins with bestMass=PLAYER_MASS_START, which is BELOW
    // `high`. Drive B for a moment so persistTopScore() runs on the
    // canonical tick path with B's lower roster max.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();

    try {
      await pageB.goto(ROOM_URL);
      await expect(pageB.getByTestId("agar-net-status")).toHaveAttribute(
        "data-connected",
        "true",
      );
      await expect
        .poll(
          async () =>
            Number(
              await pageB
                .getByTestId("agar-net-status")
                .getAttribute("data-tick"),
            ),
          { message: "first snapshot from DO (pageB)" },
        )
        .toBeGreaterThan(0);

      // Tick B forward enough that the canonical path runs the
      // persistence write several times with the lower roster max.
      // In non-monotone mode this is when the broken put overwrites
      // `high`; in default mode the monotone guard suppresses every
      // one of these attempts.
      await pageB.evaluate(() => {
        const w = window as unknown as {
          __game: {
            tick: number | (() => number);
            tickTo: (n: number) => Promise<void>;
          };
        };
        const tf = w.__game.tick;
        const cur = typeof tf === "function" ? tf() : tf;
        return w.__game.tickTo(cur + 20);
      });

      // --- Phase 3: read the persisted topScore via the test hook.
      // The hook awaits storage.get (no cache), so what we read is
      // exactly what's on disk after every write so far this match.
      const res = await pageB.request.get(TOP_SCORE_URL);
      expect(res.ok(), `GET ${TOP_SCORE_URL} → ${res.status()}`).toBe(true);
      const body = (await res.json()) as { topScore: number };

      // --- Phase 4: assert monotonicity held.
      // Default mode: persisted topScore equals `high`, NOT B's
      // lower roster max. With AGAR_DO_BREAK_MODE=non-monotone-persist
      // this assertion goes RED (the broken put overwrites with
      // PLAYER_MASS_START < high). That is the AC5 polarity contract.
      expect(
        body.topScore,
        `persisted topScore preserved A's high (=${high}), not B's lower roster max (=${PLAYER_MASS_START}). ` +
          `With AGAR_DO_BREAK_MODE=non-monotone-persist this assertion MUST go RED.`,
      ).toBe(high);
    } finally {
      await ctxB.close();
    }
  });

  test("eviction-roundtrip — post-eviction read equals pre-eviction canonical", async () => {
    test.skip(
      true,
      "unskipped by agar persistence slice 3 (e2e proves topScore survives DO eviction)",
    );

    // Contract for the slice-3 implementer:
    //
    //   This test is INTENTIONALLY DISTINCT from slice-3's own
    //   `persistence-survives-eviction.spec.ts`. That spec asserts
    //   "some persisted value > 0 after eviction". This spec asserts
    //   "the persisted value EQUALS the pre-eviction in-memory
    //   canonical.player.score". The gap matters: a lossy storage
    //   layer can return a stale-but-positive value and pass the
    //   weaker assertion. Catching that requires the equality form.
    //
    //   Shape:
    //     1. Connect to /ws?seed=S, drive score up. Capture
    //        window.__game.canonical.player.score as `expected`.
    //     2. Trigger DO eviction (mechanism owned by slice-3 — likely
    //        via a long idle window or a test-only force-evict hook).
    //     3. Reconnect / re-fetch GET /high-score?seed=S.
    //     4. Assert returned topScore === expected.
    //
    // Polarity: with AGAR_DO_BREAK_MODE=lossy-persist, this test
    // MUST go RED. Slice-1 wires that mode to drop the put silently
    // (no error to the caller, but the storage layer never commits).
    expect(true).toBe(true);
  });
});
