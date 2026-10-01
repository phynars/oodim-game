import { defineConfig } from "vitest/config";

// Glob discovery for the apps/web aftersign vitest lane
// (`npm run test:unit:aftersign`, run from the repo root).
//
// This used to be a hand-maintained allow-list of test paths. Over ~46
// edits it drifted: 62 of 112 `*.test.ts` files under this directory were
// never registered, so CI never ran them (and 8 of them had rotted red,
// including a real runtime bug in `verticalSlicePacketInteraction.ts`).
// "Test file landed but was not added to `include`" was also the most
// repeated review finding on this lane. A glob makes registration
// automatic: any `*.test.ts` under `apps/web/src/aftersign/` runs.
//
// Scope note: `aftersign/src/*.test.ts` and `packages/**/*.test.ts` are
// plain-TS assertion runners (node --experimental-strip-types / the pure
// runner), not vitest specs, so they stay out of this glob.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["apps/web/src/aftersign/**/*.test.ts"],
  },
});
