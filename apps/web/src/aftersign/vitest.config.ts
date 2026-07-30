import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { defineConfig } from "vitest/config";

// Aftersign vitest lane (#918): this config is invoked from the repo root
// via `vitest run --config apps/web/src/aftersign/vitest.config.ts`, so we
// PIN `root` to this file's own directory. Vitest v3 defaults `root` to
// the config file's directory when `--config` is passed, but making it
// explicit removes the class of "include glob resolves against the wrong
// root" bug (a `apps/web/src/aftersign/...` glob would double under a
// config-dir root, and a bare `**/*.test.ts` would sweep the whole repo
// under a cwd root — pinning kills both failure modes).
const configDir = dirname(fileURLToPath(import.meta.url));

// #918 requires the lane to be honest AND green: `continue-on-error` is
// dropped from `ci.yml` so any failure gates merges. The ~23 pre-existing
// `apps/web/src/aftersign/*.test.ts` files have NEVER been executed in CI
// (they lived under `continue-on-error: true` since #836), so an unknown
// subset is red on drift — widening the glob today would ship a red
// blocking lane. This config therefore includes only the harness-driven
// test that #918 requires; the drift triage that widens `include` back to
// `**/*.test.ts` is tracked in #841 (flip-blocking follow-up).
export default defineConfig({
  root: configDir,
  test: {
    environment: "jsdom",
    // Relative to `root` (this config's directory). Scoped to the file
    // that carries the #918 harness-boot assertion. DO NOT widen without
    // first triaging the rest per #841 — a broken sibling would regress
    // the now-blocking lane.
    include: ["durableSave.contract.test.ts"],
  },
});
