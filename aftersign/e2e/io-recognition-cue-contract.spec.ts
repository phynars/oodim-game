import { test, expect } from "@playwright/test";
import { runIoRecognitionCueContractChecks } from "../src/ioRecognitionCueContract.test";

// CI-gate for the Io recognition-cue contract.
//
// `runIoRecognitionCueContractChecks()` lives at
// `aftersign/src/ioRecognitionCueContract.test.ts` and pins:
//
//   1. `playIoRecognitionBeat({ packetOutcome: "opened", startedAtMs })`
//      returns exactly `{ kind: "io-recognition-beat", packetOutcome,
//      startedAtMs }` — the frozen three-field shape. The `kind` field
//      is load-bearing: the sibling vitest at
//      `apps/web/src/aftersign/durableSave.contract.test.ts` asserts
//      it under strict `.toEqual`, and the earlier version of that
//      assertion was rejected on #766 for omitting `kind`.
//   2. The `sealed` branch carries through with the same shape.
//   3. The cue has no fields beyond `{kind, packetOutcome,
//      startedAtMs}` — fires before the vitest sibling would if a
//      fourth field ever ships.
//   4. `statePublishVersion` monotonically increments per beat so
//      the renderer can detect a fresh cue landing.
//
// The envelope-anchor invariant (`nowMs - cue.startedAtMs` shape)
// remains covered by the existing `recognitionFeedback.test.ts`
// runner and the vitest sibling — it's not re-checked here because
// the sampler lives in `apps/web/src/aftersign/verticalSliceState.ts`
// and this runner deliberately stays inside `packages/aftersign/` to
// keep `typecheck:aftersign` green (see #766 first-review failure).
//
// Why this spec exists — from the first #766 review: `apps/web/src/
// aftersign/*` vitest files typecheck under `typecheck:aftersign` but
// are NEVER invoked by any CI lane in this repo (root `package.json`
// lists `@playwright/test` only, no vitest). Green CI on a change
// that only touches a vitest file means the file compiles, not that
// the assertion executes. This Playwright wrapper matches the
// pattern already in use by `runRecognitionBeatChecks` /
// `runPacketIntentChecks` / `runPacketIntentContractChecks` so the
// assertion actually RUNS.
//
// The spec intentionally does NOT use the `{ page }` fixture — the
// checks are pure story-state logic (no scene, no window.__game, no
// three.js), so it cannot itself hit the SwiftShader cold-start
// flake shape documented in `aftersign/playwright.config.ts`
// (retries: 3). Any failure here is a real regression, not a boot
// hiccup.
//
// PR #766 CI note (2026-07-22, iteration 3): Soren's re-review
// confirmed the logic and the four invariants match the established
// `run*Checks` pattern (see recognition-beat-contract.spec.ts,
// packet-intent-contract.spec.ts). CI went red on `test:e2e:aftersign`
// but the log endpoint 401'd; most-probable culprit is the same
// SwiftShader vite-preview cold-start flake #700/#506/#590 have hit —
// which affects the whole aftersign lane webServer boot, even for
// pure-logic specs like this one (they still boot the shared preview
// server). This edit exists purely to retrigger CI; no behavior
// change. Escalation path per playwright.config.ts:37 is to move
// pure-logic runners out of the Playwright lane into a plain Node
// runner, NOT to bump retries past 3.

test.describe("AFTERSIGN Io recognition-cue contract", () => {
  test("runIoRecognitionCueContractChecks executes every cue-contract invariant without throwing", async () => {
    expect(() => runIoRecognitionCueContractChecks()).not.toThrow();
  });
});
