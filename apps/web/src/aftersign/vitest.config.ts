import { defineConfig } from "vitest/config";

// Glob discovery for the apps/web aftersign vitest lane
// (`npm run test:unit:aftersign`, run from the repo root).
//
// App-local specs and package Vitest specs share this lane. Package files that
// are plain-TS assertion runners are not matched because they do not use the
// `.test.ts` or `.spec.ts` naming convention registered here.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "apps/web/src/aftersign/**/*.test.ts",
      "packages/**/*.{test,spec}.ts",
    ],
  },
});
