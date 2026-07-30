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
// CI-red retrigger (2026-07-30): the `test:e2e:aftersign` browser lane
// hit the documented SwiftShader cold-start flake (#700/#506/#590) on
// this PR's most recent push — a lane that does NOT run this spec (it's
// in playwright.config.ts's `testIgnore`). This comment edit exists to
// push a fresh commit so the aftersign job re-runs; the harness surface
// under this PR (the pure lane's runMemoryPromptTimingChecks) was
// already green on the prior attempt.

test.describe("AFTERSIGN memory prompt timing feel contract", () => {
  test("runMemoryPromptTimingChecks executes recognition, choice-reveal, control-lock, and monotonicity invariants without throwing", () => {
    expect(() => runMemoryPromptTimingChecks()).not.toThrow();
  });
});
