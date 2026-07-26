// AFTERSIGN plain-Node pure-logic runner (issue #826, follow-up to #825).
//
// Invoked by `npm run test:aftersign:pure` (see package.json) via
// `node --experimental-strip-types`. That script is also chained into
// `typecheck:aftersign`, and the CI aftersign job runs it BEFORE
// `test:e2e:aftersign` (see .github/workflows/ci.yml). So this file is
// the single point that guarantees every pure-logic aftersign contract
// check actually executes on CI — not just typechecks.
//
// Why plain Node (not the Playwright pure lane): the pure specs never
// touch `{ page }`, a scene, or `window.__game`. Running them through
// Playwright still pays the workerRunner + reporter overhead and drags
// them into any future config-level flake. A single Node invocation:
//   - has zero browser dependency,
//   - fails fast with a real stack trace,
//   - clearly attributes which runner threw (see catch block below).
//
// Import shape:
//   `--experimental-strip-types` needs exact `.ts` extensions on
//   relative imports. `aftersign/tsconfig.json` uses
//   `moduleResolution: "Bundler"` so the same specifiers typecheck.
//
// Adding a new pure runner: import its `run*Checks` fn, append to the
// `runners` array. That's it — the CI lane picks it up automatically.
//
// Scope note (#826): Ivy's issue also referenced
// `runIoRecognitionTimingFeelChecks()`, but that check bundle does not
// exist anywhere in `aftersign/src/` at this commit. Authoring the
// check bundle is a separate piece of work; this runner only wires in
// bundles that actually exist so no import points at a fictional file.
import { runPacketIntentChecks } from "./src/packetIntent.ts";
import { runRecognitionBeatChecks } from "./src/recognitionBeat.test.ts";
import { runIoRecognitionCueContractChecks } from "./src/ioRecognitionCueContract.test.ts";
import { runFirstCameraMoveChecks } from "./src/feel/firstCameraMove.test.ts";

type PureRunner = {
  name: string;
  run: () => void;
};

const runners: PureRunner[] = [
  { name: "runPacketIntentChecks", run: runPacketIntentChecks },
  { name: "runRecognitionBeatChecks", run: runRecognitionBeatChecks },
  { name: "runIoRecognitionCueContractChecks", run: runIoRecognitionCueContractChecks },
  { name: "runFirstCameraMoveChecks", run: runFirstCameraMoveChecks },
];

let failed = 0;
for (const runner of runners) {
  try {
    runner.run();
    console.log(`\u2713 ${runner.name}`);
  } catch (error) {
    failed += 1;
    console.error(`\u2717 ${runner.name} threw:`);
    console.error(error);
  }
}

if (failed > 0) {
  // Throw instead of `process.exit(1)`: this tsconfig pins
  // `types: ["vite/client"]` and the repo has no `@types/node`, so the
  // `process` global is undeclared under `tsc --noEmit` (TS2580) — and
  // `build:aftersign` runs that same tsconfig inside every Playwright
  // webServer boot (npc-memory / durable-save lanes included). An
  // uncaught top-level throw exits Node with a non-zero code, which is
  // all the CI lane needs.
  throw new Error(`${failed}/${runners.length} pure-logic runner(s) failed.`);
}
