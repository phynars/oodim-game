import { test, expect } from "@playwright/test";
import { runOrraRecognitionMemoryChecks } from "../src/orraRecognitionMemory";

// CI-gate for the Orra returning-memory recognition contract.
//
// `runOrraRecognitionMemoryChecks()` lives at
// `aftersign/src/orraRecognitionMemory.ts` and pins:
//
//   1. `buildOrraRecognitionMemoryFact` stamps `kind: "orra-recognition"`
//      (distinct from Io's `io-recognition`) and `npcId: "orra"` — so a
//      shared memory store can't cross-serve Io's memory to Orra's
//      recognition branch.
//   2. Different `action` values ("lit" vs "spared") produce distinct
//      durable ids — the two return-lines don't collapse.
//   3. `orraRecognitionLineForMemory(null | undefined)` selects the
//      first-contact branch with `memoryRef: null` — a fresh player never
//      sees the recognition line.
//   4. A valid Orra memory selects the recognition branch and the
//      returned `lineId` matches `ORRA_RETURN_LINE_BY_ACTION[action]`,
//      with `memoryRef` citing the memory's id.
//   5. Cross-kind guard: an Io-shaped memory (`kind: "io-recognition"`)
//      cast into the Orra selector falls through to first-contact — the
//      selector refuses to fabricate an Orra recognition from Io state.
//
// Before this spec landed, `runOrraRecognitionMemoryChecks` was
// typechecked (via `typecheck:aftersign`, tsconfig `include: ["src"]`)
// but never INVOKED by any CI runner — the aftersign lane would
// greenlight a broken invariant. This wrapper matches the established
// pattern documented in `aftersign/e2e/recognition-beat-contract.spec.ts`
// and used by `runPacketIntentChecks` / `runRecognitionBeatChecks` /
// `runIoRecognitionCueContractChecks`.
//
// Wired into the pure lane via `aftersign/playwright.pure.config.ts`'s
// `testMatch` so it runs BEFORE the SwiftShader vite-preview boot on
// `retries: 0` — any failure is a real regression, not a boot hiccup.
// The spec intentionally does NOT use the `{ page }` fixture: the
// checks are pure story-state logic (no scene, no window.__game, no
// three.js).

test.describe("AFTERSIGN Orra recognition-memory contract", () => {
  test("runOrraRecognitionMemoryChecks executes every recognition-memory invariant without throwing", async () => {
    expect(() => runOrraRecognitionMemoryChecks()).not.toThrow();
  });
});
