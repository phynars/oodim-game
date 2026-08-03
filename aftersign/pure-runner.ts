// Plain-Node pure-logic runner for AFTERSIGN check bundles.
//
// Invoked from `test:aftersign:pure` (see root package.json) via
// `node --experimental-strip-types`. This lane deliberately hosts ONLY
// check bundles whose transitive import subgraph has explicit `.ts`
// extensions on every relative specifier — Node's `--experimental-strip-types`
// strips types but does NOT add extension resolution, so extensionless
// specifiers hit `ERR_MODULE_NOT_FOUND` at import time.
//
// Currently that means one runner: `runPacketIntentChecks`, whose
// upstream module `aftersign/src/packetIntent.ts` has zero relative
// imports (verified 2026-08-02, PR #973 re-review). The four sibling
// runners named in #826 —
//   - runRecognitionBeatChecks     (aftersign/src/recognitionBeat.test.ts)
//   - runIoRecognitionCueContractChecks
//                                  (aftersign/src/ioRecognitionCueContract.test.ts)
//   - runFirstCameraMoveChecks     (aftersign/src/feel/firstCameraMove.test.ts)
//   - runMemoryPromptTimingChecks  (aftersign/src/feel/memoryPromptTiming.ts)
// — reach through modules with extensionless relative specifiers (into
// `packages/aftersign/src/` and `apps/web/src/aftersign/`, the latter of
// which the burn-down config declines to strictly typecheck). Adding
// `.ts` extensions to every specifier in that subgraph is out of scope
// for a "swap the runner" PR — a follow-up issue tracks it.
//
// Until that migration lands, those four bundles continue to run on
// `aftersign/playwright.pure.config.ts` (Playwright's bundler resolves
// extensionless specifiers), invoked in the same `test:aftersign:pure`
// npm script AFTER this runner completes. Coverage is preserved; the
// pure Playwright lane is still `retries: 0` and boots no browser, so
// it stays deterministic and cheap.
//
// Adding a new runner here — checklist:
//   1. Every relative import in the transitive subgraph MUST have a
//      `.ts` extension. Run `grep -R "from ['\"]." aftersign/src/…`
//      and confirm.
//   2. The `.test.ts` file MUST be export-only (no top-level
//      invocation), or importing it here will double-run the check
//      bundle when a Playwright spec also imports it. See
//      `aftersign/src/packetIntent.test.ts` for the shape.
//   3. Drop the corresponding entry from
//      `aftersign/playwright.pure.config.ts`'s `testMatch` in the SAME
//      PR so the bundle doesn't execute twice.

import { runPacketIntentChecks } from "./src/packetIntent.test.ts";
import { runNpcMemoryLineChecks } from "./src/narrative/npcMemoryLines.test.ts";

type Runner = {
  label: string;
  run: () => void;
};

const runners: Runner[] = [
  { label: "runPacketIntentChecks", run: runPacketIntentChecks },
  { label: "runNpcMemoryLineChecks", run: runNpcMemoryLineChecks },
];

let failed = 0;
for (const runner of runners) {
  try {
    runner.run();
    console.log(`✅ ${runner.label}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ ${runner.label}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${runners.length} pure runner(s) failed.`);
  process.exit(1);
}
