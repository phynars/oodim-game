import { test, expect } from "@playwright/test";
import { runDurableSaveRecognitionCueChecks } from "../src/durableSaveRecognitionCue.test";

// CI-gate for the durable-save × recognition-cue wire-up.
//
// `runDurableSaveRecognitionCueChecks()` lives at
// `aftersign/src/durableSaveRecognitionCue.test.ts` and pins six invariants:
//
//   1. A durable-save round-trip into a second `meetIoForAftersignSlice`
//      produces a `sampleAftersignIoMemoryBeat` with
//      `recognizesPlayer === true` and the live frozen recognition-feel.
//   2. `openAftersignIoRecognitionBeat` on that returning session publishes
//      the frozen cue shape `{ kind: "io-recognition-beat", packetOutcome,
//      startedAtMs }` — the exact three fields `playIoRecognitionBeat` in
//      `packages/aftersign/src/ioRecognitionBeat.ts` stamps. The `kind`
//      field is load-bearing; the sibling vitest at
//      `apps/web/src/aftersign/durableSave.contract.test.ts` was rejected
//      on #766 for omitting it under strict `toEqual`.
//   3. The `sealed` branch carries through with the same shape.
//   4. `sampleAftersignIoRecognitionEnvelope(cue, nowMs, options)` equals
//      `sampleRecognitionFeedbackBeat(nowMs - cue.startedAtMs, ...)` — the
//      cue is what anchors the envelope in time.
//   5. `openAftersignIoRecognitionBeat` refuses to open when Io does not
//      yet recognize the player.
//   6. `openAftersignIoRecognitionBeat` refuses to open when the returning
//      save has no committed packet outcome.
//
// Why this spec exists — from the #766 review: `apps/web/src/aftersign/*`
// vitest files typecheck under `typecheck:aftersign` but are NEVER
// invoked by any CI lane in this repo (root `package.json` lists
// `@playwright/test` only, no vitest). Green CI on a change that only
// touches a vitest file means the file compiles, not that the assertion
// executes. This Playwright wrapper matches the pattern already in use
// by `runRecognitionBeatChecks` / `runPacketIntentChecks` /
// `runPacketIntentContractChecks` so the assertion actually RUNS.
//
// The spec intentionally does NOT use the `{ page }` fixture — the checks
// are pure story-state logic (no scene, no window.__game, no three.js), so
// it cannot itself hit the SwiftShader cold-start flake shape documented
// in `aftersign/playwright.config.ts` (retries: 3). Any failure here is a
// real regression, not a boot hiccup.

test.describe("AFTERSIGN durable-save × recognition-cue contract", () => {
  test("runDurableSaveRecognitionCueChecks executes every wire-up invariant without throwing", async () => {
    expect(() => runDurableSaveRecognitionCueChecks()).not.toThrow();
  });
});
