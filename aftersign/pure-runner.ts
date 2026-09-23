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
//   - checkFirstCameraMoveReturnContract (aftersign/src/feel/firstCameraMoveReturnContract.test.ts)
//   - runMemoryPromptTimingChecks        (aftersign/src/feel/memoryPromptTiming.ts) — #978
//   - runPerfBudgetCalibrationChecks     (aftersign/src/perfBudgetCalibration.test.ts)
//   - runPlayerMovementResponsivenessChecks (aftersign/src/playerMovementResponsiveness.test.ts)
//   - runTargetLossFeedbackChecks         (aftersign/src/targetLossFeedback.test.ts) — #1721 wire-in
//   - runRouteChoicePressFeedbackChecks   (aftersign/src/routeChoicePressFeedback.test.ts) — #1806
//   - runRouteChoicePressServedContractChecks (aftersign/routeChoicePressServedContract.ts) — #1806 served pin
//   - runPacketChoiceIntentFeedbackChecks (aftersign/src/packetChoiceIntentFeedback.test.ts) — #1902
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
import { checkFirstCameraMoveReturnContract } from "./src/feel/firstCameraMoveReturnContract.test.ts";
import { runMemoryPromptTimingChecks } from "./src/feel/memoryPromptTiming.ts";
import { runPerfBudgetCalibrationChecks } from "./src/perfBudgetCalibration.test.ts";
import { runIoRecognitionDialogueContractChecks } from "./src/ioRecognitionDialogueContract.test.ts";
import { runIoRecognitionExpectedLineContractChecks } from "./src/ioRecognitionExpectedLineContract.test.ts";
// Failure-sting envelope math + flashAlpha-pinning contract. The e2e
// (packet-hold-threshold.spec.ts:140-144) drives the drift-cancel path
// end-to-end and asserts `.toBe(0.34)` on the state surface; this
// bundle pins the ENVELOPE math directly so a regression fails in the
// deterministic pure lane (retries: 0, seconds to run) BEFORE the
// SwiftShader-backed e2e lane has to shepherd 4 attempts through a
// cold browser boot. See the bundle's header comment for the specific
// invariants pinned. Every relative specifier in the subgraph is
// extension-explicit (the sole import is `./failureStingFeedback.ts`,
// a .ts module that sits inside aftersign/tsconfig.json's
// `include: ["src"]` set, so the blocking `typecheck:aftersign` gate
// resolves it deterministically), satisfying the extension-resolution
// contract documented above.
import { runFailureStingFeedbackChecks } from "./src/failureStingFeedback.test.ts";
// Io's second-packet offer copy — pure-lane consumer for the frozen
// three-tone table + playerName fallback in `ioSecondPacketCopy.ts`.
// Closes the "no consumers" gap Soren flagged on PR #1319: reviewer
// grep for `selectIoSecondPacketCopy` / `IO_SECOND_PACKET_COPY_ID`
// now finds this runner AND the check bundle. The render-site wire-in
// (main.js io-next-job → beat that stamps these lines onto #line +
// #speaker with a tap-driven e2e) is tracked as issue #1322 so the
// copy contract lands under CI before the render-side ships.
// Every relative specifier in this subgraph is `.ts`-extensioned
// (the sole import is `./ioSecondPacketCopy.ts`), satisfying the
// extension-resolution contract documented above.
import { runIoSecondPacketCopyChecks } from "./src/ioSecondPacketCopy.test.ts";
// Saint-Orra pointer line (PR #1874) — pure-lane check bundle for
// `ioSecondPacketResponseVoice.ts`. The bundle's relative imports are
// `.ts`-extensioned (`./ioSecondPacketResponseVoice.ts`,
// `./ioSecondPacketCopy.ts`), and both leaves have zero unextensioned
// relative imports, so the subgraph satisfies the pure-runner
// extension-resolution contract documented above. The `.test.ts` file
// is export-only (no top-level invocation) so importing it here does
// not double-run when a Playwright spec also imports the sibling voice
// module. The runner registration in the `runners` array below was
// added in the initial wire-up but the import was omitted, throwing
// `ReferenceError` at `test:aftersign:pure` — reviewer feedback on
// PR #1874 caught this. Fixed here.
import { runIoSecondPacketResponseVoiceChecks } from "./src/ioSecondPacketResponseVoice.test.ts";
// M-LOOP route/risk FEEL pins over the SHIPPED contract
// (`apps/web/src/aftersign/routeRiskMemory.ts` — the module main.js
// renders through `#routeRiskChoice`). Closes the "nothing consumes
// this" gap Soren blocked PR #1403 on: the bundle now imports the
// wired contract (no parallel vocabulary) and this runner is its CI
// consumer in the blocking pure lane. Extension contract holds: the
// bundle's sole relative import is `.ts`-extensioned and the leaf
// (`routeRiskMemory.ts`) has ZERO relative imports, so the subgraph
// resolves under `node --experimental-strip-types`.
import { runRouteRiskFeelChecks } from "./src/routeRiskFeel.test.ts";
// Failure-sting AUDIO-VISUAL COUPLING pin — scoped to a claim NEITHER
// sibling test asserts: FAILURE_STING.tone.durationMs (120ms audio tail,
// pinned locally in the bundle as a mirror of the frozen table in
// aftersign/failure-sting.js) must be strictly less than
// DEFAULT_FAILURE_STING_FEEL.durationMs (180ms visual envelope) by at
// least one 60Hz frame — the audio must not outlive the flash. The
// bundle's sole relative import is `./failureStingFeedback.ts`
// (.ts-extensioned, `include: ["src"]` reachable, no allowJs required),
// satisfying the pure-runner extension-resolution contract documented
// above and keeping the `typecheck:aftersign` blocking gate green.
import { runFailureStingCouplingChecks } from "./src/failureStingCoupling.test.ts";
// Frame-driven grounded-movement responsiveness — pins the render-loop
// path (`stepPlayerMovementFixedUpdate`, called from
// `aftersign/main.js:1338`) that one 60Hz frame's worth of `frameDt`
// consumes ≥ 1 fixed step, produces forward motion, and reports
// `lastStepMs` inside `targetFrameMs`. Complements — does not overlap —
// `checkPlayerMovementFeel` (which pins the SINGLE-STEP path via
// `stepPlayerMovement` directly, plus a distinct spike-cap probe on
// the accumulator with `frameDt = fixedStepSeconds * (maxSteps + 3)`).
// Sole relative import is `./playerMovementResponsiveness.ts`
// (extensioned), whose sole relative import in turn is
// `./playerMovementFeel.ts` (extensioned; zero relative imports on the
// leaf) — subgraph satisfies the pure-runner extension-resolution
// contract documented above.
import { runPlayerMovementResponsivenessChecks } from "./src/playerMovementResponsiveness.test.ts";
// Target-loss feedback envelope — pins the 100ms linear prompt fade and
// the first-frame neutral reticle reset (no residue from a previously
// held target). Pure math over `elapsedMs`, no leaves reached; the
// bundle's sole relative import is `./targetLossFeedback.ts` (extensioned,
// zero relative imports itself), so the subgraph satisfies the pure-runner
// extension-resolution contract documented above. The `.test.ts` file is
// export-only (checklist item #2) — it re-exports `runTargetLossFeedbackChecks`
// from the sibling `.ts`, no top-level invocation, so importing it here
// does not double-run the bundle.
//
// Render-side wire-in (`apps/web/src/aftersign/main.js` has no `#reticle`
// / target-loss prompt surface today — grep across `apps/web/src/aftersign/`
// for `reticle|targetLoss|promptOpacity` returns zero hits) is tracked as
// #1721 so the contract lands under CI before the render-side ships —
// same shape as the #1322 io-second-packet-copy follow-up pattern.
import { runTargetLossFeedbackChecks } from "./src/targetLossFeedback.test.ts";
// Route-choice press-feedback envelope (#1806) — pure press-math
// contract. `.test.ts` shim re-exports from `./routeChoicePressFeedback.ts`
// (extensioned); the leaf itself has ZERO relative imports, so the
// subgraph satisfies the pure-runner extension-resolution contract
// documented above.
import { runRouteChoicePressFeedbackChecks } from "./src/routeChoicePressFeedback.test.ts";
// Route-choice served-HTML contract (#1806) — pins the shipped
// `aftersign/index.html` wiring that turns the TS press-math constants
// into actual paint on `#routeChoice`:
//   • `:root { --aftersign-route-choice-press-* }` variables (values
//     must equal `ROUTE_CHOICE_PRESS_*` from the TS module),
//   • `#routeChoice button[data-aftersign-route-choice-press="pressing"]`
//     consumer CSS rule that paints the press envelope,
//   • `<script src="./routeChoicePressing.js">` tag that stamps the
//     pressing marker on pointerdown.
// Closes the "zero importers / self-test never runs" gap Soren flagged
// on PR #1806: `routeChoicePressing.js` (browser JS, can't import TS)
// and the CSS rule (can't import TS) both mirror the constants; this
// contract check reds the pure lane if any of the three drift. Lives
// OUTSIDE `aftersign/src/` because it uses `node:fs`, which the
// aftersign tsconfig's `types: ["vite/client"]` deliberately excludes
// from the strict blocking gate over `src/`.
import { runRouteChoicePressServedContractChecks } from "./routeChoicePressServedContract.ts";
// Packet-press logic-side feedback envelope (#1879) — pure state-machine
// contract. `.test.ts` shim re-exports from `./packet-press-feedback.ts`
// (extensioned); the leaf itself has ZERO relative imports, so the
// subgraph satisfies the pure-runner extension-resolution contract
// documented above. The sibling served-HTML runner below pins the
// numeric `PACKET_PRESS_FEEDBACK_MS` against the shipped
// `aftersign/index.html` :root var + `#packetButton[data-packet-press-feedback="pressed"]`
// CSS consumer rule so the two can't drift.
import { runPacketPressFeedbackChecks } from "./src/packet-press-feedback.test.ts";
// Packet-press feedback served-HTML contract (#1879) — reads the
// shipped `aftersign/index.html` and pins the :root var + consumer
// rule against the numeric `PACKET_PRESS_FEEDBACK_MS` in
// `packet-press-feedback.ts`. Reds if the served surface drifts from
// the TS source of truth. Lives OUTSIDE `aftersign/src/` because it
// uses `node:fs`, which the aftersign tsconfig's `types: ["vite/client"]`
// deliberately excludes from the strict blocking gate over `src/`.
import { runPacketPressFeedbackServedContractChecks } from "./packetPressFeedbackServedContract.ts";
// Packet-choice intent feedback (#1902) — the short, cancel-safe visual
// ack `commitPacketOutcome` in `aftersign/main.js` plays on the frame an
// irreversible packet choice commits. This bundle drives
// `playPacketChoiceIntentFeedback` against an element stub + fake timers
// and pins the five observable playback branches: (a) null-element
// early-out returns a no-op cancel (main.js's try/catch would swallow a
// throw, but the contract is silent no-op), (b) non-reduced branch
// stamps transform + transition + filter, (c) manual cancel restores
// every prior style, (d) the auto-timer at `PACKET_CHOICE_ACK_MS`
// restores every prior style with no manual cancel, and (e) the
// reduced-motion branch is brightness-only (no transform, no
// transition) — the OS-honored promise wired in main.js via
// `window.matchMedia("(prefers-reduced-motion: reduce)")`. Replaces the
// earlier tautological check (`PACKET_CHOICE_ACK_MS <= 200 && > 0`
// mirroring the same file's own constant) that Soren flagged AI003 on
// PR #1902. The `.test.ts` shim's sole relative import is
// `./packetChoiceIntentFeedback.js` (extensioned), and that leaf has
// ZERO relative imports, so the subgraph satisfies the extension-
// resolution contract documented above.
import { runPacketChoiceIntentFeedbackChecks } from "./src/packetChoiceIntentFeedback.test.ts";

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
  { label: "checkFirstCameraMoveReturnContract", run: checkFirstCameraMoveReturnContract },
  { label: "runMemoryPromptTimingChecks", run: runMemoryPromptTimingChecks },
  // Perf-budget calibration + its real consumers: the tap-side wrapper
  // `assertInputAcknowledgeAgainstCalibratedBudget` (around
  // `measureInputAcknowledgeLatency`) AND the pointer-to-render wrapper
  // `assertPointerToRenderAgainstCalibratedBudget` (around
  // `measurePointerToRenderLatency`) — both live in `perfBudgetCalibration.ts`
  // and gate on the same `PerfBudgetCalibration`. The leaf module
  // `inputAcknowledgeLatency.ts` has no relative imports; the calibration
  // module and its check bundle import it via a `.ts`-extensioned
  // specifier, so the whole subgraph satisfies the extension-resolution
  // contract documented above.
  { label: "runPerfBudgetCalibrationChecks", run: runPerfBudgetCalibrationChecks },
  { label: "runIoRecognitionDialogueContractChecks", run: runIoRecognitionDialogueContractChecks },
  { label: "runIoRecognitionExpectedLineContractChecks", run: runIoRecognitionExpectedLineContractChecks },
  { label: "runFailureStingFeedbackChecks", run: runFailureStingFeedbackChecks },
  { label: "runIoSecondPacketCopyChecks", run: runIoSecondPacketCopyChecks },
  // Saint-Orra pointer line — pinned per choice id, sibling-cross-checked
  // against the shipped `ioSecondPacketCopy.ts` contract so the pointer
  // keys can't drift from the choice ids.
  { label: "runIoSecondPacketResponseVoiceChecks", run: runIoSecondPacketResponseVoiceChecks },
  // M-LOOP route/risk FEEL — pins over the SHIPPED contract
  // (`apps/web/src/aftersign/routeRiskMemory.ts`, rendered via
  // `#routeRiskChoice`). Imported above but was omitted from this
  // array in the initial wire-up, so the bundle typechecked but never
  // ran in CI. Registering it here closes the gap Soren flagged on
  // the #1528 re-review — "even the correct bundle isn't executed
  // today."
  { label: "runRouteRiskFeelChecks", run: runRouteRiskFeelChecks },
  // Failure-sting AUDIO-VISUAL COUPLING — pins the audio-tail vs
  // visual-envelope inequality (tone.durationMs < feel.durationMs, with
  // one-frame headroom). Complements the sibling
  // `runFailureStingFeedbackChecks` which covers the visual envelope
  // math and reduced-motion split, and the node:test-based
  // `failure-sting.test.js` which covers the audio envelope shape.
  // Neither of those pins the cross-table inequality.
  { label: "runFailureStingCouplingChecks", run: runFailureStingCouplingChecks },
  // Frame-driven grounded-movement responsiveness — pins the render-loop
  // accumulator path (`stepPlayerMovementFixedUpdate`) that one 60Hz
  // frame's worth of `frameDt` consumes ≥ 1 fixed step, produces
  // forward motion, and reports `lastStepMs` inside `targetFrameMs`.
  // Imported above but was omitted from this array in the initial
  // wire-up — same gap Soren flagged on #1528 for `runRouteRiskFeelChecks`.
  { label: "runPlayerMovementResponsivenessChecks", run: runPlayerMovementResponsivenessChecks },
  // Target-loss feedback envelope — 100ms linear prompt fade + neutral
  // reticle reset on the first frame. Pure math contract; render-side
  // wire-in (main.js `#reticle` / target-loss prompt surface) is tracked
  // as #1721.
  { label: "runTargetLossFeedbackChecks", run: runTargetLossFeedbackChecks },
  // Route-choice press feedback (#1806) — pure press-math contract.
  // The TS module is the source of truth for scale / lift / hold-ms;
  // the sibling served-HTML runner below pins those constants against
  // the shipped `aftersign/index.html` wiring.
  { label: "runRouteChoicePressFeedbackChecks", run: runRouteChoicePressFeedbackChecks },
  // Route-choice served-HTML contract (#1806) — reads the shipped
  // `aftersign/index.html` and pins the four :root vars, the CSS
  // consumer rule on `#routeChoice button[data-aftersign-route-choice-press="pressing"]`,
  // and the `<script src="./routeChoicePressing.js">` tag against
  // the numeric constants in `routeChoicePressFeedback.ts`. Reds if
  // the served surface drifts from the TS source of truth (or if
  // either of `#acknowledgeRouteButton` / `#skipRouteButton` is
  // renamed / moved out of `#routeChoice`).
  {
    label: "runRouteChoicePressServedContractChecks",
    run: runRouteChoicePressServedContractChecks,
  },
  // Packet-press logic-side feedback envelope (#1879) — pure
  // state-machine contract. The TS module is the source of truth for
  // `PACKET_PRESS_FEEDBACK_MS`; the sibling served-HTML runner below
  // pins that constant against the shipped `aftersign/index.html`
  // wiring.
  { label: "runPacketPressFeedbackChecks", run: runPacketPressFeedbackChecks },
  // Packet-press feedback served-HTML contract (#1879) — reads the
  // shipped `aftersign/index.html` and pins the :root var + the
  // `#packetButton[data-packet-press-feedback="pressed"]` consumer
  // rule against the numeric constant in `packet-press-feedback.ts`.
  // Reds if the served surface drifts from the TS source of truth
  // (or if `#packetButton` is renamed).
  {
    label: "runPacketPressFeedbackServedContractChecks",
    run: runPacketPressFeedbackServedContractChecks,
  },
  // Packet-choice intent feedback (#1902) — pins the five observable
  // playback branches of `playPacketChoiceIntentFeedback` (null-element
  // no-op, transform/transition/filter stamp, cancel restores priors,
  // auto-timer restores priors, reduced-motion collapses to brightness
  // only). Reds if a future edit breaks the reduced-motion promise, the
  // prior-style restore path, or the ≤200ms immediate-ack budget the
  // wire-in in `commitPacketOutcome` depends on.
  { label: "runPacketChoiceIntentFeedbackChecks", run: runPacketChoiceIntentFeedbackChecks },
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
