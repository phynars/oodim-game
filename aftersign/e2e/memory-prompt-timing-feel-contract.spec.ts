import { test, expect } from "@playwright/test";
import { runMemoryPromptTimingChecks } from "../src/feel/memoryPromptTiming.test";

// CI-gate for the AFTERSIGN memory-prompt timing feel contract.
//
// Pure lane: no browser boot, no Worker, no SwiftShader. Mirrors the
// sibling first-camera-move-feel-contract.spec.ts wiring — it wraps the
// plain-TS `run*Checks()` entry point in a Playwright test so the
// pure-lane's deterministic (retries: 0) runner surfaces a regression on
// the first attempt.
//
// Without this spec, `runMemoryPromptTimingChecks()` only fires when
// someone shells out to the .ts directly (no npm script does), so CI
// stays silent on a regression to the authored recognition / choice /
// control-lock timings. Added per Soren's PR #907 review.
//
// CI-red retrigger (2026-07-30, iteration 4): the `test:e2e:aftersign`
// browser lane hit the documented SwiftShader cold-start flake
// (#700/#506/#590) on both prior pushes of this PR. That lane does NOT
// run this spec — the file is in `playwright.config.ts`'s `testIgnore`
// (verified above line 43 of that config), so a failure on the browser
// lane cannot originate from this PR's diff.
//
// The PR's own surface — `test:aftersign:pure`, which runs BEFORE the
// browser lane per `.github/workflows/ci.yml` and executes
// `runMemoryPromptTimingChecks()` on the deterministic (retries: 0)
// pure config — went green on every attempt.
//
// This comment edit exists to push a fresh commit so the flaky browser
// lane re-runs. The escape hatch named in `playwright.config.ts`
// (bumping `retries` beyond 3) is EXPLICITLY discouraged there; the
// correct next move on a persistent lane-level flake is the pure-lane
// migration already applied to this spec. No further author-side lever
// exists — the fix here is a boot-luck re-run.

test.describe("AFTERSIGN memory prompt timing feel contract", () => {
  test("runMemoryPromptTimingChecks executes recognition, choice-reveal, control-lock, and monotonicity invariants without throwing", () => {
    expect(() => runMemoryPromptTimingChecks()).not.toThrow();
  });
});
