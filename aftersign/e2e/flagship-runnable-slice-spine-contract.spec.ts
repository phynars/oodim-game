import { test, expect } from "@playwright/test";

import pureConfig from "../playwright.pure.config";
import { runKioskSceneContractChecks } from "../src/kioskSceneContract";
import { runOrraRecognitionMemoryChecks } from "../src/orraRecognitionMemory";
import { HARD_NAVIGATION_SAVE_CONTRACT_SLOT } from "../src/hardNavigationSaveSurvival";
import { getNextVerticalSliceMilestone } from "../src/verticalSliceMilestones";

// Product-spine guard for the AFTERSIGN runnable slice.
//
// This is intentionally pure: no page fixture, no webServer, no browser.
// The vertical slice only becomes shippable when three player-facing
// promises stay present together:
//   1. one kiosk scene,
//   2. one remembering NPC,
//   3. durable save/load survival.
//
// What each spine arm actually gates (per Soren's PR #895 review):
//
// - Kiosk + orra invoke the real zero-arg contract runners
//   (`runKioskSceneContractChecks()`, `runOrraRecognitionMemoryChecks()`).
//   Break any invariant those runners pin (drop a beat, weaken the
//   recognition rule) and THIS spec fails on the runner's throw.
//
// - Save-survival is different: its contract is snapshot-shaped rather
//   than a zero-arg runner. The browser-driven arm lives in
//   `durable-save-load.spec.ts` and only makes sense with a real
//   document boundary. Re-feeding a hand-built snapshot to
//   `assertHardNavigationSaveSurvival()` here would only re-run what the
//   sibling `hard-navigation-save-survival-contract.spec.ts` already
//   runs against the same snapshot (Soren's #895 nit). Instead, the
//   save arm gates the load-bearing SLOT CONSTANT
//   (`HARD_NAVIGATION_SAVE_CONTRACT_SLOT === "default"`): if anyone
//   renames the slot string in `aftersign/src/hardNavigationSaveSurvival.ts`,
//   the flagship save-load hook shifts out from under the story-state
//   contract (`docs/flagship/story-state-contract.md` §"save") and this
//   guard goes red BEFORE the individual contract spec has a chance to.
//
// Together with the pure-lane `testMatch` allow-list check below, that
// gives one clear signal when the vertical slice loses a load-bearing
// invariant — not a scattered failure across three unrelated specs.

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
    // Save-survival's runner is snapshot-shaped, not zero-arg. Rather
    // than re-run the sibling contract spec's own assertion against a
    // duplicated snapshot (Soren's #895 nit), we gate the SLOT CONSTANT
    // — the one load-bearing string the story-state contract pins
    // (§"save"), and the one thing a rename would silently break.
    runChecks: () => {
      if (HARD_NAVIGATION_SAVE_CONTRACT_SLOT !== "default") {
        throw new Error(
          `AFTERSIGN save-survival slot constant must remain "default" ` +
            `to match docs/flagship/story-state-contract.md §"save" ` +
            `(got: ${HARD_NAVIGATION_SAVE_CONTRACT_SLOT})`,
        );
      }
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

    // (2) Each spine promise's invariant must currently hold. Kiosk and
    //     orra call their real contract runners; save-survival checks
    //     the load-bearing slot constant (see header for why it isn't
    //     re-running the snapshot assertion). If any of these three
    //     goes red, the spine has lost an invariant before the
    //     individual contract spec even runs.
    for (const promise of RUNNABLE_SLICE_SPINE) {
      expect(
        () => promise.runChecks(),
        `spine promise "${promise.playerPromise}" must satisfy its contract invariant`,
      ).not.toThrow();
    }
  });

  test("keeps the milestone queue focused on work that is already in flight", () => {
    // Anchors the next non-merged milestone against the vertical-slice
    // list. If the list drifts — a new milestone is prepended, or the
    // in-flight one gets marked merged without the successor being
    // added — this assertion fires before the roadmap loses its head.
    expect(getNextVerticalSliceMilestone()?.id).toBe("io-remembers-prior-session");
  });
});
