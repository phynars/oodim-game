import { defineConfig } from "vitest/config";

// Glob discovery for the apps/web aftersign vitest lane
// (`npm run test:unit:aftersign`, run from the repo root).
//
// App-local specs under `apps/web/src/aftersign/` are picked up by a glob.
//
// For `packages/` we use an explicit allow-list because the directory mixes
// two test styles at the same depth:
//   - vitest specs (import { describe, it } from "vitest")
//   - plain-TS assertion runners (use top-level `describe`/`test` as
//     node-runner globals, no vitest import)
// A glob would pull in both and vitest would throw
// `ReferenceError: describe is not defined` on the runner files
// (e.g. ioFirstArrival.test.ts, ioRecognitionBeat.test.ts,
// ioReturningSession.test.ts at `packages/aftersign/src/`). The allow-list
// below is every file under `packages/` that imports from "vitest".
export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "apps/web/src/aftersign/**/*.test.ts",
      // packages/aftersign vitest specs (top-level — the 3 runner-style
      // *.test.ts at the same depth are deliberately excluded)
      "packages/aftersign/src/computeOfferedJobs.test.ts",
      "packages/aftersign/src/interactionConfirm.test.ts",
      "packages/aftersign/src/jobOfferActionFingerprint.test.ts",
      "packages/aftersign/src/storyStateHarness.test.ts",
      "packages/aftersign/src/feel/interactionConfirm.spec.ts",
      // packages/aftersign vitest specs (narrative-triage)
      "packages/aftersign/src/narrative-triage/io-first-route-lines.test.ts",
      "packages/aftersign/src/narrative-triage/io-interaction-confirm.test.ts",
      "packages/aftersign/src/narrative-triage/io-memory-lines.test.ts",
      "packages/aftersign/src/narrative-triage/io-recognition-beat.test.ts",
      "packages/aftersign/src/narrative-triage/io-returning-memory-surface.test.ts",
      "packages/aftersign/src/narrative-triage/io-slice-copy.test.ts",
      "packages/aftersign/src/narrative-triage/orra-memory-lines.test.ts",
      "packages/aftersign/src/narrative-triage/orra-recognition-beat.test.ts",
      "packages/aftersign/src/narrative-triage/orra-returning-memory-surface.test.ts",
      // packages/flagship vitest specs
      "packages/flagship/src/packetSeal.test.ts",
    ],
  },
});
