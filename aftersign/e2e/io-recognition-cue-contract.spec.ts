import { test, expect } from "@playwright/test";
import { runIoRecognitionCueContractChecks } from "../src/ioRecognitionCueContract.test";

// CI-gate for the Io recognition-cue contract.
//
// `runIoRecognitionCueContractChecks()` lives at
// `aftersign/src/ioRecognitionCueContract.test.ts` and pins the frozen
// three-field cue shape { kind, packetOutcome, startedAtMs }, its
// sealed/opened branches, its no-extra-fields invariant, and the
// per-beat `statePublishVersion` monotonicity — the same shape the
// vitest sibling `apps/web/src/aftersign/durableSave.contract.test.ts`
// asserts under strict `.toEqual`.
//
// Runs on `aftersign/playwright.pure.config.ts` (pure lane, retries: 0,
// no browser boot, no vite-preview) via the `test:aftersign:pure` npm
// script. Excluded from the main lane's `testIgnore` so the pure lane
// is the sole gate. Not on the plain-Node runner
// (`aftersign/pure-runner.ts`) because the transitive subgraph pulls
// `../../packages/aftersign/src/ioRecognitionBeat` with an
// extensionless specifier; Node's `--experimental-strip-types` cannot
// resolve that (PR #973 review). Playwright bundles the graph and
// resolves it natively; a follow-up issue tracks the specifier-
// extension migration.
//
// The spec intentionally does NOT use the `{ page }` fixture — the
// checks are pure story-state logic (no scene, no window.__game, no
// three.js), so it cannot itself hit the SwiftShader cold-start flake
// shape documented in `aftersign/playwright.config.ts` (retries: 3).
// Any failure here is a real regression, not a boot hiccup.

test.describe("AFTERSIGN Io recognition-cue contract", () => {
  test("runIoRecognitionCueContractChecks executes every cue-contract invariant without throwing", async () => {
    expect(() => runIoRecognitionCueContractChecks()).not.toThrow();
  });
});
