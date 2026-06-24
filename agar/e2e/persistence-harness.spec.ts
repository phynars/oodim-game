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

  test("high-score-shape — GET /high-score wire contract (#338)", async ({
    request,
  }) => {
    // File-time test (no browser): the wire-shape contract should
    // fail at the cheapest possible level. A browser-driven test is
    // overkill for status-code checks, and a flake at that layer
    // would mask wire-shape regressions behind player-input timing.
    //
    // Production read surface contract (agar/docs/persistence-slice-2-
    // contract.md §"Wire contract"):
    //   - never-played seed → 200 + { topScore: 0 }
    //   - missing seed param → 400
    //   - non-GET method     → 405

    // Never-played seed: a fresh random seed routes to a DO that has
    // never persisted a value → zero default (callers treat absence
    // as 0; invariant topScore >= 0).
    const neverPlayed = `neverplayed-${Math.random().toString(36).slice(2)}`;
    const zeroRes = await request.get(
      `${WORKER_BASE}/high-score?seed=${neverPlayed}`,
    );
    expect(
      zeroRes.status(),
      `GET /high-score?seed=${neverPlayed} (never played) → 200`,
    ).toBe(200);
    const zeroBody = (await zeroRes.json()) as { topScore: number };
    expect(zeroBody.topScore, "never-played seed defaults to 0").toBe(0);

    // Missing seed param → 400.
    const noSeedRes = await request.get(`${WORKER_BASE}/high-score`);
    expect(
      noSeedRes.status(),
      "GET /high-score with no seed param → 400",
    ).toBe(400);

    // Non-GET method → 405 (public endpoint is read-only; the POST
    // seam lives on /__test/top-score).
    const postRes = await request.post(
      `${WORKER_BASE}/high-score?seed=anything`,
      { data: { topScore: 999 } },
    );
    expect(
      postRes.status(),
      "POST /high-score → 405 (read-only public endpoint)",
    ).toBe(405);
  });

  test("monotonic-persist — a lower score never overwrites a higher one", async ({
    browser,
    request,
  }) => {
    // Fixed seed (not a random-per-test seed). Persistence is keyed
    // by seed → DO id, and we need the SAME DO to see A's high write
    // and then B's lower-score attempt. A random seed would still
    // work in a single test run, but a fixed seed keeps the failure
    // trail reproducible if this ever flakes.
    const SEED = 7319;
    const ROOM_URL = `/agar/?seed=${SEED}`;
    // Seed phase still POSTs the known HIGH through the test-only
    // write seam (the only way to inject a high without a 60s pellet
    // sweep — see phase 1). Slice 2 (#338) rewired the readback to
    // the production GET endpoint below.
    const SEED_URL = `${WORKER_BASE}/__test/top-score?seed=${SEED}`;
    // Phase-3 readback now hits the PRODUCTION read surface
    // (GET /high-score) instead of the test GET hook, which slice 2
    // removed. Both read the same storage.get('topScore') off the
    // same seed→DO, so the non-monotone-persist polarity still bites
    // through this surface (slice-2 contract §3).
    const HIGH_SCORE_URL = `${WORKER_BASE}/high-score?seed=${SEED}`;

    // --- Phase 1: seed a HIGH value directly via the slice-1 test
    // hook (POST /__test/top-score).
    //
    // Earlier drafts of this spec drove pageA through a 4-direction
    // sweep to grow bestMass via pellet eats. That coupled the
    // polarity gate (`high > PLAYER_MASS_START`) to spawn-pellet
    // geometry AND bot collision luck — at SEED=7319 the sweep can
    // plausibly meet a mass-48 bot before a pellet, killing the
    // gate without any persistence regression (PR #320 review).
    //
    // The persistence contract is decoupled from how `high` got
    // there: AC2 is "current > cached → put"; AC3 is "break mode
    // drops the > guard". POSTing a known value through the SAME
    // storage.put path (see worker.ts /__test/top-score POST
    // handler) proves the storage layer reached disk for the seed
    // value. Phase 2 then opens a real WS session — which is the
    // ONLY way to exercise persistTopScore on the canonical tick
    // path — so the polarity assertion still tests the production
    // code, not just the hook.
    const HIGH = PLAYER_MASS_START + 100; // any value > the floor
    const seedRes = await request.post(SEED_URL, {
      data: { topScore: HIGH },
    });
    expect(
      seedRes.ok(),
      `POST ${SEED_URL} seeding HIGH=${HIGH} → ${seedRes.status()}`,
    ).toBe(true);
    const seedBody = (await seedRes.json()) as { topScore: number };
    expect(
      seedBody.topScore,
      "POST hook readback echoes the seeded HIGH",
    ).toBe(HIGH);
    const high = HIGH;

    // --- Phase 2: open playerB with a fresh browser context (fresh
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

      // --- Phase 3: read the persisted topScore via the PRODUCTION
      // endpoint (slice 2, #338). GET /high-score awaits storage.get
      // (no cache), so what we read is exactly what's on disk after
      // every write so far this match — same source the removed test
      // GET hook read, just through the real product surface.
      const res = await pageB.request.get(HIGH_SCORE_URL);
      expect(res.ok(), `GET ${HIGH_SCORE_URL} → ${res.status()}`).toBe(true);
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
