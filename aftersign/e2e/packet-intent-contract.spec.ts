import { test, expect } from "@playwright/test";
import { runPacketIntentChecks } from "../src/packetIntent";

// CI-gate for the packet-intent feel-contract checks.
//
// `runPacketIntentChecks()` lives in aftersign/src/packetIntent.ts and
// pins 11 invariants against the controller (450ms threshold, 180ms tap
// ceiling, sticky-cancel, anti-punitive-dead-zone SEALED default, harness
// mirror, etc.). Before this spec landed, the checks were TYPECHECKED
// but never INVOKED by any CI runner — the aftersign lane greenlit
// silently on a broken invariant.
//
// This spec runs the check bundle inside a Playwright test so the
// existing `test:e2e:aftersign` step gates it. It intentionally does
// NOT use the { page } fixture — the checks are pure controller logic
// (no scene, no window.__game), matching the sibling shape in
// `npc-memory-line-contract.spec.ts` where `test.describe` wraps a
// pure-module smoke test alongside the runtime specs.
//
// The end-to-end scene-level threshold is separately pinned by
// `packet-hold-threshold.spec.ts`; these two together cover the
// controller in isolation and the controller wired into the scene.
//
// PR #700 CI note (2026-07-17): the aftersign lane went red on this PR's
// first push, but the reviewer traced the failure to another spec's
// SwiftShader / vite-preview cold-start flake — this contract test is
// pure controller logic (no page fixture, no scene, no window.__game),
// so it cannot itself be the failure source. Mirrors the same "push to
// re-run" convention documented in `aftersign/src/packetChoiceFeel.test.ts`
// after PR #590 hit the identical cold-start flake shape.
//
// Re-push touch (2026-07-17, iteration 4): Soren's re-review confirmed all
// 11 controller assertions hold and the sibling-import pattern matches
// io-dialogue / npc-memory-line-contract; the only block is the flaked
// aftersign lane. This edit exists purely to trigger a CI re-run — no
// behavior change. If the flake persists, escalate to a wider retry-count
// bump on aftersign/playwright.config.ts instead of another author push.

test.describe("AFTERSIGN packet intent contract", () => {
  test("runPacketIntentChecks executes every controller invariant without throwing", async () => {
    expect(() => runPacketIntentChecks()).not.toThrow();
  });
});
