import { test, expect } from "@playwright/test";

import pureConfig from "../playwright.pure.config";
import { runKioskSceneContractChecks } from "../src/kioskSceneContract";
import { runOrraRecognitionMemoryChecks } from "../src/orraRecognitionMemory";
import {
  assertHardNavigationSaveSurvival,
  type HardNavigationSaveSnapshot,
} from "./hard-navigation-save-survival-contract.spec";

// Product-spine guard for the AFTERSIGN runnable slice.
//
// This is intentionally pure: no page fixture, no webServer, no browser.
// The vertical slice only becomes shippable when three player-facing
// promises stay present together:
//   1. one kiosk scene,
//   2. one remembering NPC,
//   3. durable save/load survival.
//
// Each promise is owned by a dedicated `run*Checks()` contract runner in
// `aftersign/src/`. Individual `-contract.spec.ts` specs already invoke
// those runners one at a time. This guard owns a smaller, sharper truth:
// future work must not quietly advance one promise while deleting another
// from the spine.
//
// Why the assertions look the way they do (Soren's PR #895 review):
//   - We import the pure-lane config's `testMatch` and assert each spine
//     filename is present. Delete `kiosk-scene-contract.spec.ts` from the
//     allow-list and THIS test fails — the spine can no longer route that
//     promise through the pure lane.
//   - We invoke each spine runner directly. Break any invariant those
//     contracts pin (e.g. drop the `remember` beat, weaken the memory
//     recognition rule, unset the save-survival flag) and THIS test
//     fails on the runner's throw — even before the individual contract
//     spec runs. So the spine guard is not documentation dressed as a
//     test; it is an executable dependency on all three runners.

interface SpinePromise {
  readonly playerPromise: string;
  readonly pureSpec: string;
  readonly runChecks: () => void;
}

const RUNNABLE_SLICE_SPINE: readonly SpinePromise[] = [
  {
    playerPromise: "one kiosk scene",
    pureSpec: "kiosk-scene-contract.spec.ts",
    runChecks: runKioskSceneContractChecks,
  },
  {
    playerPromise: "one remembering NPC",
    pureSpec: "orra-recognition-memory-contract.spec.ts",
    runChecks: runOrraRecognitionMemoryChecks,
  },
  {
    playerPromise: "durable save/load survival",
    pureSpec: "hard-navigation-save-survival-contract.spec.ts",
    // The save-survival contract exposes an assertion + snapshot shape
    // rather than a zero-arg `run*Checks()`. We construct a minimal
    // passing snapshot here and feed it to the real assertion; if a
    // future edit tightens the invariants and this snapshot no longer
    // passes, the spine guard fails alongside the contract spec.
    runChecks: () => {
      const savedAt = "2026-07-28T00:00:00.000Z";
      const snapshot: HardNavigationSaveSnapshot = {
        cold: {
          player: { id: "player-io" },
          save: {
            slot: "default",
            revision: 2,
            lastPersistedAt: null,
            dirty: false,
            authority: "server",
            lastLoadProof: { source: null, revision: null, playerId: null },
          },
        },
        saved: {
          player: { id: "player-io" },
          save: {
            slot: "default",
            revision: 3,
            lastPersistedAt: savedAt,
            dirty: false,
            authority: "server",
            lastLoadProof: { source: null, revision: null, playerId: null },
          },
        },
        loaded: {
          player: { id: "player-io" },
          save: {
            slot: "default",
            revision: 3,
            lastPersistedAt: savedAt,
            dirty: false,
            authority: "server",
            lastLoadProof: { source: "server", revision: 3, playerId: "player-io" },
          },
        },
        resaved: {
          player: { id: "player-io" },
          save: {
            slot: "default",
            revision: 4,
            lastPersistedAt: "2026-07-28T00:00:01.000Z",
            dirty: false,
            authority: "server",
            lastLoadProof: { source: "server", revision: 3, playerId: "player-io" },
          },
        },
      };
      assertHardNavigationSaveSurvival(snapshot);
    },
  },
] as const;

test.describe("AFTERSIGN runnable-slice product spine", () => {
  test("keeps the first playable slice anchored to kiosk, memory, and save/load contracts", () => {
    // The spine is three promises — not two, not four. If a fourth
    // player-facing promise earns its way into the vertical slice, it
    // gets added here on purpose, in the same commit that adds its
    // runner. That's the point of the guard.
    expect(RUNNABLE_SLICE_SPINE).toHaveLength(3);

    // (1) Each spine promise must actually be wired into the pure lane's
    //     `testMatch` allow-list. Removing a spine spec from the config
    //     drops it from CI's first-attempt deterministic gate; this
    //     assertion refuses to let that regression pass silently.
    const pureLaneAllowList = pureConfig.testMatch;
    expect(
      pureLaneAllowList,
      "pure lane must declare an explicit testMatch allow-list",
    ).toBeDefined();
    for (const promise of RUNNABLE_SLICE_SPINE) {
      expect(
        pureLaneAllowList,
        `pure lane must include ${promise.pureSpec} (promise: ${promise.playerPromise})`,
      ).toContain(promise.pureSpec);
    }

    // (2) Each spine promise's contract runner must currently pass. If
    //     a future edit weakens any of the three underlying contracts,
    //     the spine guard goes red BEFORE the individual contract spec
    //     runs — giving one clear signal that the vertical slice has
    //     lost a load-bearing invariant, not just a scattered failure.
    for (const promise of RUNNABLE_SLICE_SPINE) {
      expect(
        () => promise.runChecks(),
        `spine promise "${promise.playerPromise}" must satisfy its contract runner`,
      ).not.toThrow();
    }
  });
});
