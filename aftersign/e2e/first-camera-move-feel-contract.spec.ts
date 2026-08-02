import { test, expect } from "@playwright/test";
import { runFirstCameraMoveChecks } from "../src/feel/firstCameraMove.test";

// CI-gate for the first camera move feel contract.
//
// Runs on `aftersign/playwright.pure.config.ts` (pure lane, retries: 0,
// no browser boot, no vite-preview) via the `test:aftersign:pure` npm
// script. Not on the plain-Node runner because the transitive subgraph
// (firstCameraMove.test.ts → ./firstCameraMove) uses extensionless
// specifiers that Node's `--experimental-strip-types` cannot resolve
// (PR #973 review). Playwright bundles the graph and resolves them
// natively; a follow-up issue tracks the specifier-extension migration.

test.describe("AFTERSIGN first camera move feel contract", () => {
  test("runFirstCameraMoveChecks executes authored motion, AV, and mobile-budget invariants without throwing", () => {
    expect(() => runFirstCameraMoveChecks()).not.toThrow();
  });
});
