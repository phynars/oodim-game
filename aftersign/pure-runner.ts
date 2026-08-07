// Plain-Node pure-logic runner for AFTERSIGN check bundles.
//
// Invoked from `test:aftersign:pure` (see root package.json) via
// `node --experimental-strip-types`. This lane deliberately hosts ONLY
// check bundles whose transitive import subgraph has explicit `.ts`
// extensions on every relative specifier — Node's `--experimental-strip-types`
// strips types but does NOT add extension resolution, so extensionless
// specifiers hit `ERR_MODULE_NOT_FOUND` at import time.
//
// Currently registered runners:
//   - runPacketIntentChecks              (aftersign/src/packetIntent.test.ts)
//   - runNpcMemoryLineChecks             (aftersign/src/narrative/npcMemoryLines.test.ts)
//   - runRecognitionFeedbackBridgeChecks (aftersign/src/recognitionFeedbackBridge.test.ts)
//   - runRecognitionBeatChecks           (aftersign/src/recognitionBeat.test.ts) — #978
//   - runIoRecognitionCueContractChecks  (aftersign/src/ioRecognitionCueContract.test.ts) — #978
//   - runFirstCameraMoveChecks           (aftersign/src/feel/firstCameraMove.test.ts) — #978
//   - runMemoryPromptTimingChecks        (aftersign/src/feel/memoryPromptTiming.ts) — #978
//
// Every relative specifier in every one of those subgraphs is
// `.ts`-extensioned (verified 2026-08-02 for the first three; verified
// this PR for the #978 four via `grep "from ['\"]\." aftersign/src/...`
// returning either no relative imports at all or only extensioned
// hops). The pure Playwright lane
// (`aftersign/playwright.pure.config.ts`) still exists for future
// bundles that haven't yet had their subgraphs de-extensioned; when a
// bundle graduates, drop its spec from that config's `testMatch` in
// the SAME PR that adds it here.
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
import { runRecognitionFeedbackBridgeChecks } from "./src/recognitionFeedbackBridge.test.ts";
import { runRecognitionBeatChecks } from "./src/recognitionBeat.test.ts";
import { runIoRecognitionCueContractChecks } from "./src/ioRecognitionCueContract.test.ts";
import { runFirstCameraMoveChecks } from "./src/feel/firstCameraMove.test.ts";
import { runMemoryPromptTimingChecks } from "./src/feel/memoryPromptTiming.ts";

type Runner = {
  label: string;
  run: () => void;
};

const runners: Runner[] = [
  { label: "runPacketIntentChecks", run: runPacketIntentChecks },
  { label: "runNpcMemoryLineChecks", run: runNpcMemoryLineChecks },
  // Bridge between recognitionFeedback.ts (typed contract) and the
  // main.js render loop. Hot render path — signGlowBoost sums into
  // signLight.intensity every frame during the recognition beat, so a
  // sign regression here silently flattens the pre-bloom dip that
  // reviewer on #1008 caught. Every relative specifier in this
  // subgraph is extensioned (.ts/.js), so it satisfies the pure-runner
  // extension-resolution contract documented above.
  { label: "runRecognitionFeedbackBridgeChecks", run: runRecognitionFeedbackBridgeChecks },
  // #978 migration (all four): the leaf modules these bundles reach —
  // packages/aftersign/src/ioReturningSession.ts,
  // packages/aftersign/src/ioRecognitionBeat.ts,
  // apps/web/src/aftersign/recognitionFeedback.ts,
  // aftersign/src/feel/firstCameraMove.ts, and
  // aftersign/src/feel/memoryPromptTiming.ts — contain ZERO relative
  // imports (grep-verified: `from ['"]\.` returns no hits inside those
  // leaves), and every relative specifier in the .test.ts-level
  // importers is `.ts`-extensioned, so the whole subgraph satisfies
  // the extension-resolution contract documented above.
  { label: "runRecognitionBeatChecks", run: runRecognitionBeatChecks },
  { label: "runIoRecognitionCueContractChecks", run: runIoRecognitionCueContractChecks },
  { label: "runFirstCameraMoveChecks", run: runFirstCameraMoveChecks },
  { label: "runMemoryPromptTimingChecks", run: runMemoryPromptTimingChecks },
  { label: "runPacketChoiceIntentChecks", run: runPacketChoiceIntentChecks },
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
