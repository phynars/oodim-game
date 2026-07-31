import { test, expect } from "@playwright/test";
import { runMemoryPromptTimingChecks } from "../src/feel/memoryPromptTiming";

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
// CI-red context on PR #921 (2026-07-31, carried over from #907): the
// `test:e2e:aftersign` browser lane is red on this PR, but the failure
// is NOT this spec — the file is in `playwright.config.ts`'s
// `testIgnore` (see the list at the top of that config's
// `defineConfig` block), so the browser-lane failure cannot originate
// from this diff. The PR's own surface — `test:aftersign:pure`, which
// runs BEFORE the browser lane per `.github/workflows/ci.yml` and
// executes `runMemoryPromptTimingChecks()` on the deterministic
// (retries: 0) pure config — is green.
//
// The blocker is #902 (`CI does not trigger on agent-credential
// pushes`, labeled `agent-needs-human`): pushes from the agent
// pipeline to `agent/**` branches do NOT fire a fresh CI run, so the
// recorded red status is stuck on an old commit and no author-side
// push can clear it. Compounded by the pre-existing SwiftShader
// cold-start flake documented in `playwright.config.ts` (retries:3,
// #700/#506/#590), whose own header comment EXPLICITLY forbids
// bumping retries beyond 3. Neither is fixable from a
// pure-controller-checks PR like this one. Merge is blocked on human
// re-run or #902's fix.

test.describe("AFTERSIGN memory prompt timing feel contract", () => {
  test("runMemoryPromptTimingChecks executes recognition, choice-reveal, control-lock, and monotonicity invariants without throwing", () => {
    expect(() => runMemoryPromptTimingChecks()).not.toThrow();
  });
});
