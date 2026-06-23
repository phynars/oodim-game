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

  test("monotonic-persist — a lower score never overwrites a higher one", async () => {
    test.skip(
      true,
      "unskipped by agar persistence slice 1 (DO state.storage.put on score-up)",
    );

    // Contract for the slice-1 implementer:
    //
    //   1. Connect to /ws?seed=S, drive score up to some HIGH value
    //      via WS input, capture canonical.player.score as `high`.
    //   2. Force a LOWER score to attempt to land. Two viable
    //      mechanisms (slice-1 picks one and notes it in the PR):
    //        (a) AGAR_DO_BREAK_MODE=non-monotone-persist, which
    //            slice-1 wires so the DO writes whatever score the
    //            reducer emits even when it's lower than the
    //            currently-persisted value (i.e. broken monotonicity).
    //        (b) A second connection that deliberately re-seeds /
    //            stalls / writes a synthetic lower score through the
    //            same put path.
    //   3. Read storage via the slice-2 endpoint GET /high-score?seed=S.
    //   4. Assert the returned value equals `high`, NOT the lower one.
    //
    // Polarity: with AGAR_DO_BREAK_MODE=non-monotone-persist, this
    // test MUST go RED. The slice-3 polarity CI workflow (a separate
    // sub-issue per #307 scope) is what enforces that on every push.
    expect(true).toBe(true);
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
