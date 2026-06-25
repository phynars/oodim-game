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

  test("high-score-shape — GET /high-score wire contract (status + body)", async ({
    request,
  }) => {
    // File-time wire-shape gate for slice 2's production read endpoint
    // (issue #338). No browser — the status/body contract should fail
    // at the cheapest level, not behind player-input timing. Polarity
    // is the three explicit shape assertions below; a regression in
    // the worker's /high-score branch (wrong status, wrong key, or a
    // dropped 400/405 guard) turns one of them RED.

    // Never-played seed → 200 + {topScore:0}. A random suffix keeps
    // this independent of any DO another test seeded.
    const neverPlayed = `neverplayed-${Math.random().toString(36).slice(2)}`;
    const zeroRes = await request.get(
      `${WORKER_BASE}/high-score?seed=${neverPlayed}`,
    );
    expect(
      zeroRes.status(),
      `GET /high-score?seed=${neverPlayed} → ${zeroRes.status()}`,
    ).toBe(200);
    const zeroBody = (await zeroRes.json()) as { topScore: number };
    expect(zeroBody.topScore, "never-played seed defaults to 0").toBe(0);

    // Missing seed → 400.
    const missingRes = await request.get(`${WORKER_BASE}/high-score`);
    expect(
      missingRes.status(),
      "GET /high-score with no seed → 400",
    ).toBe(400);

    // Wrong method → 405. The public endpoint is read-only; the POST
    // seam lives on /__test/top-score, not here.
    const methodRes = await request.post(
      `${WORKER_BASE}/high-score?seed=anything`,
    );
    expect(
      methodRes.status(),
      "POST /high-score → 405 (read-only endpoint)",
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
    // Seed phase still uses the POST test hook — the only way to
    // inject a known HIGH without driving 60+ seconds of pellet
    // sweep. Phase-3 readback uses the production /high-score
    // endpoint (slice 2, issue #338); it reads the SAME
    // storage.get('topScore') the hook wrote, so the polarity holds.
    const TOP_SCORE_URL = `${WORKER_BASE}/__test/top-score?seed=${SEED}`;
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
    const seedRes = await request.post(TOP_SCORE_URL, {
      data: { topScore: HIGH },
    });
    expect(
      seedRes.ok(),
      `POST ${TOP_SCORE_URL} seeding HIGH=${HIGH} → ${seedRes.status()}`,
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

      // --- Phase 3: read the persisted topScore via the production
      // /high-score endpoint (slice 2, issue #338). Like the old test
      // hook it awaits storage.get (no cache), so what we read is
      // exactly what's on disk after every write so far this match —
      // now observed through the real product surface.
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

  test("eviction-roundtrip — post-eviction read equals pre-eviction canonical", async ({
    browser,
  }) => {
    // Slice 3 — THE RUNG (issue #347). Unskipped per the unskip
    // ledger: "unskipped by agar persistence slice 3 (e2e proves
    // topScore survives DO eviction)".
    //
    // This test is INTENTIONALLY DISTINCT from a happy-path
    // "some value > 0 after eviction" spec. It asserts the
    // post-eviction read EQUALS the pre-eviction in-memory canonical
    // topScore (max bestMass across the roster — the reducer carries
    // no literal `player.score`; topScore is the MAX bestMass, see
    // worker.ts currentTopScore()). A lossy storage layer can return
    // a stale-but-positive value and pass a weaker assertion; only
    // the equality form catches it.
    //
    // Eviction mechanism: `POST /__test/evict` drops the DO's
    // in-memory persistence cache + resets the load-once guard, so
    // the next read re-hydrates from `state.storage` through the same
    // `loadTopScoreOnce()` path a freshly-evicted DO uses. The
    // epic-plan "spike" (force real miniflare eviction) has no stable
    // public API; this hook exercises the genuine reload-from-disk
    // code path without faking storage (the evict hook deliberately
    // never touches state.storage). See worker.ts /__test/evict.
    // A unique per-run seed. `wrangler dev` persists DO storage to a
    // local sqlite under `.wrangler/state` BETWEEN runs, so a fixed
    // seed would let a prior run's persisted topScore leak in — that
    // stale-but-positive value is exactly the failure the contract
    // warns about, and it would also un-RED the lossy polarity (the
    // broken run would read a value the green run committed earlier).
    // A fresh seed per run guarantees storage starts empty for this
    // DO, the same discipline `high-score-shape` uses with its
    // `neverplayed-${random}` seed. The randomness lives only in the
    // seed string → DO id; the in-DO behavior is fully deterministic.
    const SEED = `evict-${Math.random().toString(36).slice(2)}`;
    const ROOM_URL = `/agar/?seed=${SEED}`;
    const EVICT_URL = `${WORKER_BASE}/__test/evict?seed=${SEED}`;
    const HIGH_SCORE_URL = `${WORKER_BASE}/high-score?seed=${SEED}`;

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      // --- Phase 1: open a real WS session and drive ticks so the
      // canonical persistTopScore() path commits the current top
      // (max bestMass) to state.storage. bestMass floors at
      // PLAYER_MASS_START (>0), so a connected roster always yields a
      // positive topScore — no dependency on pellet-eat geometry.
      await page.goto(ROOM_URL);
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

      // Tick forward so persistTopScore runs the canonical write
      // several times.
      await page.evaluate(() => {
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

      // Capture the pre-eviction in-memory canonical topScore: the
      // MAX bestMass across the roster (mirrors worker.ts
      // currentTopScore()). This is the value the canonical path
      // persisted — and the value the post-eviction read must equal.
      const expected = await page.evaluate(() => {
        const w = window as unknown as {
          __game: {
            canonical: {
              players: { bestMass: number }[];
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
      expect(
        expected,
        "pre-eviction canonical topScore (max bestMass) is positive",
      ).toBeGreaterThan(0);

      // --- Phase 2: simulate DO eviction. POST /__test/evict drops
      // the in-memory cachedTopScore + resets the load-once guard.
      // After this, the DO has no in-memory memory of the high score;
      // the only place it survives is state.storage.
      const evictRes = await page.request.post(EVICT_URL);
      expect(
        evictRes.ok(),
        `POST ${EVICT_URL} → ${evictRes.status()}`,
      ).toBe(true);

      // --- Phase 3: read the persisted topScore back through the
      // production /high-score endpoint. It awaits loadTopScoreOnce()
      // then reads state.storage directly — so a value here proves it
      // came from DISK, not the (now-wiped) in-memory cache.
      const res = await page.request.get(HIGH_SCORE_URL);
      expect(res.ok(), `GET ${HIGH_SCORE_URL} → ${res.status()}`).toBe(true);
      const body = (await res.json()) as { topScore: number };

      // --- Phase 4: equality assertion. The post-eviction read must
      // EQUAL the pre-eviction canonical, proving a lossless reload
      // from storage. With AGAR_DO_BREAK_MODE=lossy-persist the
      // canonical put never commits, so storage stays 0 while
      // `expected` is positive — this assertion goes RED. That is the
      // contract's polarity (lossy → stale/zero → mismatch).
      expect(
        body.topScore,
        `post-eviction topScore reloaded from storage equals pre-eviction ` +
          `canonical (=${expected}). With AGAR_DO_BREAK_MODE=lossy-persist ` +
          `this assertion MUST go RED (storage never committed → 0 !== ${expected}).`,
      ).toBe(expected);
    } finally {
      await ctx.close();
    }
  });
});
