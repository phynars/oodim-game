import { test, expect } from "@playwright/test";
import { runRecognitionBeatChecks } from "../src/recognitionBeat.test";

// CI-gate for the Io returning-session recognition-beat contract checks.
//
// `runRecognitionBeatChecks()` lives in aftersign/src/recognitionBeat.test.ts
// and pins twelve invariants across two surfaces (LINE RESOLVER +
// FEEL ENVELOPE — see that file's inline docs for the full list).
//
// This spec runs on `aftersign/playwright.pure.config.ts` (the pure lane,
// retries: 0, no browser boot, no vite-preview) via the `test:aftersign:pure`
// npm script. It is EXCLUDED from the main lane's `testIgnore` so it does
// not also run there — the pure lane is the sole gate.
//
// Why still on Playwright and not the plain-Node runner in
// `aftersign/pure-runner.ts` — the transitive import subgraph reaches
// `../../packages/aftersign/src/ioReturningSession` and
// `../../apps/web/src/aftersign/recognitionFeedback` with extensionless
// specifiers. Node's `--experimental-strip-types` requires explicit `.ts`
// extensions on every specifier and does not add extension resolution;
// Playwright bundles the graph and resolves extensionless imports natively.
// PR #973 review (Soren) documented this as too wide a blast radius for
// a "swap the runner" PR; a follow-up issue tracks the extension pass.
//
// The spec intentionally does NOT use the { page } fixture — the checks
// are pure controller/resolver logic (no scene, no window.__game, no
// three.js), so it cannot itself hit the SwiftShader cold-start flake
// shape documented in `aftersign/playwright.config.ts` (retries: 3).
// Any failure here is a real regression, not a boot hiccup.

test.describe("AFTERSIGN Io recognition-beat contract", () => {
  test("runRecognitionBeatChecks executes every line-resolver and feel-envelope invariant without throwing", async () => {
    expect(() => runRecognitionBeatChecks()).not.toThrow();
  });
});
