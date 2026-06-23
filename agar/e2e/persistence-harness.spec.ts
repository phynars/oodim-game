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
    page,
    baseURL,
  }) => {
    // Slice-1 implementation (issue #319).
    //
    // Score proxy: the reducer carries `bestMass` per player (highest
    // mass that player has held this match) — there's no literal
    // `player.score` in the world. Slice-1 picks max(bestMass) across
    // the player roster as topScore (monotone-on-the-canonical-path,
    // since bestMass never decreases inside step()).
    //
    // Readback mechanism (per AC4): a TEMPORARY worker hook at
    // `/__test/top-score?seed=S` that returns the persisted value.
    // This is removed when slice 2's `/high-score` endpoint lands.
    //
    // Lower-write mechanism (picks option (b) from the contract):
    //   1. Connect, drive bestMass up high via eating food, capture.
    //   2. Disconnect, then reconnect under a FRESH cid. The fresh
    //      player joins with bestMass=PLAYER_MASS_START (16), the
    //      old player has been folded out via the leaves frame, so
    //      `currentTopScore()` drops to PLAYER_MASS_START.
    //   3. Next canonical tick calls persistTopScore() with a value
    //      < cachedTopScore. The monotone `>` guard MUST drop it.
    //   4. Read back via /__test/top-score — assert it still equals
    //      the high we captured in step 1.
    //
    // Polarity proof: running with AGAR_DO_BREAK_MODE=non-monotone-persist
    // drops the guard in worker.ts (persistTopScore writes
    // unconditionally), so step 3 overwrites and step 4's
    // `expect(stored).toBe(high)` fails. RED on the broken mode,
    // GREEN by default — mirrors #276's discipline.

    // Unique seed per test → fresh DO instance (mirrors the same
    // discipline as multiplayer-convergence.spec.ts).
    const SEED = String(Math.floor(Math.random() * 1_000_000) + 1);
    const ROOM_URL = `/agar/?seed=${SEED}`;

    await page.goto(ROOM_URL);

    // Gate on the WS handshake + first snapshot, same shape as
    // multiplayer-smoke.spec.ts. Reads against `window.__game` are
    // unsafe until canonical lands.
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

    // Drive bestMass up. Strategy: hold one direction for many ticks
    // — the cell crosses pellets and grows. We rely on the existing
    // drive surface in __game; if not present, fail loud rather than
    // skip. Polling on bestMass > start guarantees we actually scored,
    // even if the seed's food layout makes the first sweep barren
    // (we then try the orthogonal direction).
    const PLAYER_MASS_START = 16;
    const HIGH_TARGET = 32; // 2× start; well under MAX_MASS=1024.

    async function readBestMass(): Promise<number> {
      return await page.evaluate(() => {
        const g = (window as unknown as {
          __game: { canonical: unknown };
        }).__game;
        const canon = g.canonical as {
          players?: Array<{ bestMass?: number }>;
        } | null;
        if (!canon || !Array.isArray(canon.players)) return 0;
        let max = 0;
        for (const p of canon.players) {
          if (typeof p.bestMass === "number" && p.bestMass > max) {
            max = p.bestMass;
          }
        }
        return max;
      });
    }

    async function sendInput(dir: string): Promise<void> {
      await page.evaluate((d) => {
        const g = (
          window as unknown as { __game: { sendInput?: (d: string) => void } }
        ).__game;
        if (typeof g.sendInput === "function") g.sendInput(d);
      }, dir);
    }

    // Sweep in a square pattern to maximize pellet collisions
    // regardless of spawn position. Each segment runs for ~30 ticks
    // (1.5s at 20Hz). We poll bestMass between segments and bail out
    // once we cross HIGH_TARGET.
    const DIRS = ["right", "down", "left", "up"];
    for (let sweep = 0; sweep < 8; sweep++) {
      const dir = DIRS[sweep % DIRS.length] ?? "right";
      await sendInput(dir);
      // ~30 ticks per segment. Poll cadence is 100ms; the bail-out
      // check runs each poll so a fast eater exits early.
      const start = Date.now();
      while (Date.now() - start < 1600) {
        const cur = await readBestMass();
        if (cur >= HIGH_TARGET) break;
        await page.waitForTimeout(100);
      }
      const cur = await readBestMass();
      if (cur >= HIGH_TARGET) break;
    }

    const high = await readBestMass();
    expect(
      high,
      "test setup failed — could not drive bestMass above start",
    ).toBeGreaterThan(PLAYER_MASS_START);

    // Disconnect the page (closes the WS). The DO folds a `leaves`
    // frame on the next tick and the player is removed from the
    // roster. We can't navigate away cleanly without losing the
    // page handle, so we close the WS via the test-surface drive
    // fn if present; otherwise reload, which forces a fresh cid.
    await page.evaluate(() => {
      const g = (
        window as unknown as {
          __game: { disconnectWs?: () => void };
        }
      ).__game;
      if (typeof g.disconnectWs === "function") g.disconnectWs();
    });

    // Reload under the SAME seed → same DO instance, but the agar
    // client mints a fresh clientId per page load (see
    // CLIENT-TEST-SURFACE.md / src/main.ts). The new cid joins with
    // bestMass=PLAYER_MASS_START, dropping max(bestMass) below `high`.
    await page.reload();
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
        { message: "first snapshot after reconnect" },
      )
      .toBeGreaterThan(0);

    // At least one canonical tick (and therefore at least one
    // persistTopScore() call) has fired by the time data-tick > 0.
    // Wait a few more ticks to be sure the post-reconnect roster
    // (with only the fresh, lower-bestMass player) has been folded
    // and persistTopScore has had its chance to mis-write under the
    // non-monotone-persist break mode.
    await page.waitForTimeout(300);

    // Read back via the temporary slice-1 hook. The hook lives on
    // the Worker (wrangler dev at 127.0.0.1:8787 per
    // agar/playwright.config.ts), NOT on the vite preview that
    // serves /agar/. We hit the Worker origin directly. The `seed`
    // query routes to the same DO instance the WS connection was
    // talking to (idFromName("match:" + seed)).
    void baseURL;
    const res = await page.request.get(
      `http://127.0.0.1:8787/__test/top-score?seed=${SEED}`,
    );
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { topScore: number };

    // The assertion: with the monotonic guard in place (default
    // break mode), the persisted topScore equals the HIGH we drove
    // pre-reconnect — the lower post-reconnect roster never
    // overwrites it. Under AGAR_DO_BREAK_MODE=non-monotone-persist
    // the guard is dropped and this fails (the polarity proof).
    expect(body.topScore).toBe(high);
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
