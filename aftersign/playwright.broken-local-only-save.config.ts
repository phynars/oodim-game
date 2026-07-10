import baseConfig from "./playwright.config";
import { defineConfig } from "@playwright/test";

// AFTERSIGN durable save/load — RED-polarity sibling for the local-only-save
// break mode. Reuses the normal aftersign webServer stack and runs the SAME
// save-load-durable-contract.spec.ts assertions, but exposes
// FLAGSHIP_BREAK_MODE=local-only-save to the Playwright runner so the skipped
// durable contract becomes live.
//
// Under the current localStorage-only implementation this spec MUST FAIL after
// the harness clears localStorage and cold-reloads the same slot. The workflow
// inverts that exit code: failure means the guard caught the missing durable
// path; success means the guard is too weak.
export default defineConfig({
  ...baseConfig,
  retries: 0,
  workers: 1,
});
