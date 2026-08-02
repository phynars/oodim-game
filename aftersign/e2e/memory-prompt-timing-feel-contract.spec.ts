import { test, expect } from "@playwright/test";
import { runMemoryPromptTimingChecks } from "../src/feel/memoryPromptTiming";

// CI-gate for the AFTERSIGN memory-prompt timing feel contract.
//
// Runs on `aftersign/playwright.pure.config.ts` (pure lane, retries: 0,
// no browser boot, no vite-preview) via the `test:aftersign:pure` npm
// script. Excluded from the main lane's `testIgnore` so the pure lane
// is the sole gate. Not on the plain-Node runner
// (`aftersign/pure-runner.ts`) because the transitive subgraph uses
// extensionless specifiers that Node's `--experimental-strip-types`
// cannot resolve (PR #973 review). Playwright bundles and resolves
// natively; a follow-up issue tracks the specifier-extension
// migration.

test.describe("AFTERSIGN memory prompt timing feel contract", () => {
  test("runMemoryPromptTimingChecks executes recognition, choice-reveal, control-lock, and monotonicity invariants without throwing", () => {
    expect(() => runMemoryPromptTimingChecks()).not.toThrow();
  });
});
