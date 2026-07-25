import { test, expect } from "@playwright/test";
import { runPacketIntentChecks } from "../src/packetIntent";

// AFTERSIGN packet-intent feel-contract — dual-lane gate.
//
// `runPacketIntentChecks()` pins 11 controller invariants (450ms hold
// threshold, 180ms tap ceiling, sticky-cancel, anti-punitive-dead-zone
// SEALED default, harness mirror, etc.). Before PR #700 these checks were
// typechecked but never invoked; before PR #828 they were invoked only on
// the flaky Playwright/SwiftShader lane.
//
// PR #828 adds a plain-Node lane (`test:aftersign:pure` via
// `aftersign/pure-runner.ts`) chained into `typecheck:aftersign` so the
// contract runs under `node --import tsx` on CI without a browser boot.
// This spec is retained so the SAME check bundle also runs inside the
// existing `test:e2e:aftersign` step during migration — a regression
// trips whichever lane executes first, and coverage is not lost while
// the pure lane proves itself.
//
// The spec intentionally does NOT use the `{ page }` fixture: the
// checks are pure controller logic (no scene, no window.__game),
// matching the sibling shape in `npc-memory-line-contract.spec.ts`.
// End-to-end scene-level thresholds are separately pinned by
// `packet-hold-threshold.spec.ts`.
test.describe("AFTERSIGN packet intent contract", () => {
  test("runPacketIntentChecks executes every controller invariant without throwing", async () => {
    expect(() => runPacketIntentChecks()).not.toThrow();
  });
});

// Re-export kept so any future consumer (or the pure runner, if it is
// ever restructured to pull through this module) has a stable barrel.
export { runPacketIntentChecks };
