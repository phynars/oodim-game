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

export default defineConfig({
  root: configDir,
  test: {
    environment: "jsdom",
    // Relative to `root` (this config's directory). Matches every
    // `*.test.ts` under apps/web/src/aftersign/**.
    include: ["**/*.test.ts"],
  },
});
