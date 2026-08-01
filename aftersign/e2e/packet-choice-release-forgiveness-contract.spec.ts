import { test, expect } from "@playwright/test";
import { runPacketChoiceReleaseForgivenessChecks } from "../src/feel/packetChoiceReleaseForgiveness";

// AFTERSIGN packet-choice release-forgiveness feel-contract — pure lane.
//
// `runPacketChoiceReleaseForgivenessChecks()` pins the five invariants
// that keep a finger-up on the first commit-eligible frame from being
// punished as a stale release:
//   1. opening release on the first commit-eligible frame commits
//   2. opening release forgiveness does NOT bypass seal inspection
//   3. preserve release on the first commit-eligible frame commits
//   4. stale releases after the forgiveness window still cancel
//   5. drag-away cancellation wins over release forgiveness
// Plus a 60Hz frame-budget bookkeeping check.
//
// Following the sibling convention (packet-intent-contract.spec.ts):
// the checks are pure controller logic — no `{ page }` fixture, no
// scene boot, no window.__game. This spec is registered on the pure
// Playwright lane (`test:aftersign:pure`) via the explicit `testMatch`
// allow-list in `aftersign/playwright.pure.config.ts`, so it runs
// deterministically (retries: 0) without paying the vite-preview +
// SwiftShader boot tax.
test.describe("AFTERSIGN packet choice release-forgiveness contract", () => {
  test("runPacketChoiceReleaseForgivenessChecks executes every invariant without throwing", async () => {
    expect(() => runPacketChoiceReleaseForgivenessChecks()).not.toThrow();
  });
});

// Re-export kept for symmetry with the packet-intent contract spec.
export { runPacketChoiceReleaseForgivenessChecks };
