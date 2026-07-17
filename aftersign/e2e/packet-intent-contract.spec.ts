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

test.describe("AFTERSIGN packet intent contract", () => {
  test("runPacketIntentChecks executes every controller invariant without throwing", async () => {
    expect(() => runPacketIntentChecks()).not.toThrow();
  });
});
