// AFTERSIGN — main game module.
// Extracted verbatim from the inline <script type="module"> in index.html
// (2026-08-01, flagship DoD amendment §5): index.html is no longer the
// hot file — edit the module that owns your slice. The window.__game
// state contract is unchanged and asserted by the e2e suite.
import * as THREE from "three";
import { createKioskScene } from "./src/kioskScene.js";
import {
  DEFAULT_EVALUATE_PACKET_INTENT_THRESHOLDS,
  evaluatePacketIntent,
  PacketIntentController,
  PACKET_OUTCOME,
} from "./src/packetIntent.js";
import {
  buildPacketOutcomeMemoryFact,
  buildSecondActionMemoryFact,
  memoryRefsFromMemory,
  normalizeSecondAction,
  SECOND_ACTION,
  secondActionFromMemory,
} from "./src/memoryFacts.js";
import {
  actionForOrraChoice,
  buildOrraRecognitionMemoryFact,
  coerceOrraRecognitionMemory,
  lineCopyForOrraLineId,
  ORRA_FIRST_CONTACT_LINE_ID,
  ORRA_RETURN_LINE_BY_ACTION,
  selectOrraRecognitionLine,
} from "./src/orraRuntimeLane.ts";
import { canonicalFlagshipBeat } from "./flagship-beat-migration.js";
import { IO_RECOGNITION_BEAT_FEEDBACK } from "./recognition-beat-feedback.js";
import { recognitionEnvelopeAt as recognitionFeedbackEnvelopeAt } from "./src/recognitionFeedbackBridge.ts";
import {
  applyRecognitionDomFeedback,
  computeRecognitionDomFeedback,
  clearRecognitionDomFeedback,
} from "./recognition-dom-feedback.js";
import {
  clearAuthoritativeSave,
  readAuthoritativeSave,
  writeAuthoritativeSave,
} from "./server-authoritative-save.js";
import { chooseIoReturningSessionLine } from "../packages/aftersign/src/ioReturningSession";
// Note (PR #1236): the direct import of `AFTERSIGN_NEXT_JOB_BEAT` was
// removed here — the served-page handoff line is now sourced through
// `buildIoContinueBeats(reason)[1].line` (see the import right below).
// The `packages/aftersign/next-job-beat.js` module still owns the
// canonical beat id/objective and is consumed elsewhere (harness /
// narrative-triage); this module speaks its line through the story-
// facing continue-beats builder so REPLY and HANDOFF live on one axis.
//
// Shipped consumer of `apps/web/src/aftersign/story/ioContinueBeats.ts`
// (PR #1236). `buildIoContinueBeats(reason)` returns the two beats Io
// speaks after the player strikes a return posture:
//   [0] IoContinueReplyBeat    — Io's reply to the tone the player chose
//                                (rendered by lineForBeat at the tone-
//                                reply beat below).
//   [1] IoContinueHandoffBeat  — the invariant red-tag → Saint Orra
//                                handoff line (rendered by lineForBeat
//                                at the following handoff beat).
// The three recognition-beat buttons (Kind / Evasive / Blunt) stamp
// `data-return-reason` (see recognition-beat labeling below), and the
// click handlers store the picked reason on `state.player.returnReason`
// so `lineForBeat()` can look up the matching REPLY + HANDOFF lines
// from this module — not from an inline hardcoded string, and not
// only from the packages/aftersign next-job-beat module. This closes
// the "beat the served page never imports" gap Soren flagged on the
// first draft.
//
// Source-order guard: this comment deliberately avoids naming the beat
// ids literally — mcontinueReachableBeats.test.ts asserts source-order
// by `indexOf` on the raw beat-id strings, so a literal quote up here
// (before the real branches in `lineForBeat`) inverts the ordering and
// reds the test. Same discipline as the npcMemoryDialogue comment
// further down.
import {
  buildIoContinueBeats,
  IO_RETURN_TONE_OPTIONS,
} from "../apps/web/src/aftersign/story/ioContinueBeats.ts";
import { ioNextJobLine } from "./src/ioNextJobDialogue.js";
import { selectIoSecondPacketCopyForReturnReason } from "./src/ioSecondPacketCopy.ts";
import {
  stampAftersignBeat,
  stampAftersignChoice,
} from "./src/playerVisibleBeatDom.js";
// Shipped consumer of the NPC-memory dialogue dispatcher — turns the
// exports from a spec-only module into a load-bearing surface. At the
// terminal beat in `lineForBeat()` below (reached by tapping through
// packet-choice → recognition → the tone fork → the terminal beat),
// we ask the dispatcher for the memory-reflection lines her durable
// facts justify, and speak the joined text as Io's opening beat before
// the authored pitch. So the same tap that advances the beat now
// renders `ioMemoryResponseLinesFor(...)` into `#line`, satisfying
// Soren's "wire it into served dialogue plus a tap-driven e2e"
// requirement on PR #1228.
//
// Source-order invariant: the reachable-beats graph is asserted by a
// pure test (see apps/web/src/aftersign/mcontinueReachableBeats.test.ts)
// against beat-id occurrences in this file — this comment deliberately
// avoids naming those ids so the invariant is anchored solely by their
// real occurrences inside `lineForBeat()` below, not by comment text.
import { ioMemoryResponseLinesFor } from "./src/npcMemoryDialogue.js";
// Shipped consumer of the NPC memory-recall dialogue module (PR #1343 —
// Soren's second review). The vitest harness surface at
// `apps/web/src/aftersign/windowGameSurface.ts` wires
// `findAftersignNpcMemoryRecallLine` into a "roundTrip" beat, but that
// surface is imported ONLY by `bootWindowGame.ts` — the served
// `aftersign/main.js` never touched the module, so the authored recall
// line never reached the real `#line` DOM node. Same shape as the
// #1228 fix: prepend the recall line to the terminal-handoff beat's
// joined utterance below, so the same tap that lands the player at
// that beat also renders the recall assertion text into `#line`.
// Sibling `aftersign/e2e/npc-memory-recall-dialogue-served.spec.ts`
// drives the served page and asserts the assertion text is present.
//
// Source-order guard: this comment deliberately AVOIDS naming the
// beat ids literally (`io-return-recognition`, `return-tone-choice`,
// the handoff beat), because
// `apps/web/src/aftersign/mcontinueReachableBeats.test.ts` asserts
// their order in this file by `String.indexOf` on the raw beat-id
// strings. A literal quote up here — before the real branches in
// `lineForBeat()` below — inverts the ordering and reds the test.
// Same discipline as the `ioMemoryResponseLinesFor` and
// `ioContinueBeats` comments right above.
import { findAftersignNpcMemoryRecallLine } from "../apps/web/src/aftersign/npcMemoryRecallDialogue.ts";
import {
  DEFAULT_KIOSK_CAMERA_RIG,
  computeKioskCameraTarget,
  createKioskCameraRigState,
  stepKioskCameraRig as stepKioskCameraRigModel,
} from "./src/kioskCameraRig.js";
import {
  DEFAULT_PLAYER_MOVEMENT_FEEL,
  checkPlayerMovementFeel,
  createPlayerMovementState,
  normalizeMoveInput,
  stepPlayerMovement as stepPlayerMovementModel,
  stepPlayerMovementFixedUpdate,
} from "./src/playerMovementFeel.ts";
import {
  DEFAULT_MOBILE_MOVE_PAD_FEEL,
  attachMobileMovePad,
  checkMobileMovePadFeel,
} from "./src/mobileMovePad.js";
import {
  DEFAULT_FAILURE_STING_FEEL,
  failureStingEnvelopeAt,
} from "./src/failureStingFeedback.ts";
import {
  INTERACTION_CONFIRM_FEEL,
  interactionConfirmEnvelopeAt,
} from "./src/interactionConfirmFeel.js";
import { createReducedMotionPreference } from "./src/reducedMotionPreference.js";
import {
  buildIoRecognitionDialogueSnippets,
  selectIoRecognitionDialogueLine,
} from "./src/ioRecognitionDialogue.ts";
// Return-tone choice feel — pinned 39-value table (3 postures × 13
// numbers) authored under apps/web/. Wiring it into main.js here is
// what turns the module from a contract-only design token into a
// SHIPPED consumer: the served surface exposes
// `window.__game.applyReturnToneFeel(reason)`, which stamps the
// press envelope's CSS variables onto the [data-aftersign-return-surface]
// node in index.html. The same reason token that drives the voice
// memory thread now also drives the DOM press envelope — one axis,
// one lookup, no drift between voice and feel.
import {
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
  applyAftersignReturnToneChoiceFeel,
} from "../apps/web/src/aftersign/returnToneChoiceFeel.ts";
// Tap-choice target feel — pinned 44px minimum on both axes for every
// button that COMMITS a fork (packet gesture, route-memory forks,
// delivery). Wiring it into main.js here is what turns
// `tapChoiceFeel.ts` from a pure primitive into a SHIPPED runtime
// contract: the served surface exposes
// `window.__game.getTapChoiceFeelReport()`, which walks every
// `[data-aftersign-tap-choice]` element in the live DOM and reports
// per-surface width/height + shortfall. A future renderer regression
// (a 40px button, a squished packet tap zone) reds
// servedSurface.contract.test.ts + any dev overlay that reads the
// report before the player ever mis-taps.
import {
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  assertAftersignTapChoiceSurfaces,
} from "../apps/web/src/aftersign/tapChoiceFeel.ts";
import { measureTapTargetAdjacency } from "../apps/web/src/aftersign/mobileTapTargetFeel.ts";
// Tap-confirm feel — flagship press envelope stamped on the ONE button
// the player just committed with (packet, acknowledge/skip route,
// deliver, ask-for-next-job). Wiring it into main.js here is what
// turns `tapConfirmFeel.ts` from a pure primitive (with harness-only
// consumers) into a SHIPPED consumer on the served page: the four
// click handlers below call
// `window.__game.applyTapConfirmFeel(choiceId)` BEFORE `choose(...)`
// so the CSS variables + `data-aftersign-tap-confirm="armed"` marker
// land on the very element the finger just touched, and only that
// element (a tray-wide flash would smear the beat). Same file, same
// choice-id vocabulary as the tap-choice size seam right above — one
// axis, no drift between "the button is big enough" and "the button
// felt like it counted".
import {
  applyFlagshipTapConfirmFeel,
  FLAGSHIP_TAP_CONFIRM_FEEL,
} from "../apps/web/src/aftersign/tapConfirmFeel.ts";
// Orra's first-name dialogue — the pharmacy-sign beat where Saint
// Orra hands the courier a sealed name-case. Wiring it into main.js
// here is what turns `orraFirstNameDialogue.ts` from a contract-only
// data module into a SHIPPED consumer: the served surface exposes
// `window.__game.renderOrraFirstNameDialogue(choiceId)`, which
// resolves the beat and stamps `#speaker` / `#line` with the joined
// lines + `data-beat-id="orra-first-name"` + `data-choice-id`. A
// tap harness can locate the beat via attribute selectors (same
// vocabulary as `stampAftersignBeat` / `stampAftersignChoice`), and
// a player sees Orra's voice land in the shipped `#line` paragraph.
// Sibling `orraFirstNameDialogue.servedButton.test.ts` drives every
// choice against the real served `index.html` and pins the stamps.
import {
  renderOrraFirstNameDialogue,
} from "../apps/web/src/aftersign/orraFirstNameDialogue.ts";
// M-LOOP-E1 (#1372) — route/risk choice each run, recorded as a
// memory fact that feeds the next run. Wiring it into main.js here
// turns `routeRiskMemory.ts` from a pure contract into a SHIPPED
// consumer: the served surface stamps two tappable buttons into
// `[data-aftersign-route-risk-surface]` during the packet-choice
// beat, each tap records `state.player.routeRisk` (piggybacks on
// `buildPersistPayload`'s `player` clone, so it round-trips across
// reload with zero new persistence code), and the runtime seams
// `window.__game.renderRouteRiskChoice()` +
// `window.__game.getOfferedActions()` expose the same shape to the
// harness. The action set diverges next run — the "loop" input the
// sibling `computeOfferedActions` consumer needs.
import {
  AFTERSIGN_ROUTE_RISK_SURFACE_SELECTOR,
  computeOfferedActions,
  recordRouteRun,
  renderRouteRiskChoice,
} from "../apps/web/src/aftersign/routeRiskMemory.ts";
// #1395 — computeOfferedJobs served-page consumer. Wiring it in main.js
// here is what closes the gap Ivy filed in #1393/#1395: the primitive
// (packages/aftersign/src/computeOfferedJobs.ts) already ships and the
// harness surface (apps/web/src/aftersign/windowGameSurface.ts) consumes
// it, but the SERVED aftersign/main.js never rendered its output — so
// a returning player who reaches `packet-offered` saw only the packet-
// tap button, not the completed-set job offers. At renderText() below
// the packet-offered beat now derives PlayerMemory from the durable
// `state.packet.delivered` flag (delivered → `priorOutcome:"completed"`,
// undelivered → undefined → safe default) and stamps one
// `<button id="job-offer-<jobId>" data-aftersign-tap-choice="offer-<jobId>">`
// per selected id into `#offeredJobs`. Sibling e2e
// `aftersign/e2e/job-offers-played.spec.ts` plays the loop and pins the
// completed-set render.
import { selectIoJobOffers } from "../packages/aftersign/src/computeOfferedJobs";
// PR #1422 — per-jobId M-LOOP action authoring layered on TOP of the
// `selectIoJobOffers` output. `selectIoJobOffers` owns which jobIds are
// offered and the visible `label · risk` text; this module owns the
// memory-gated action id that rides on `lastAction` and the
// `data-mloop-*` attributes stamped on each button so a played-through
// e2e can pin the memory posture the tap committed under.
import {
  getMloopAvailableAction,
  selectMloopJobCopy,
} from "./mloop-copy.js";
import { stampJobOfferData } from "./src/jobOfferDom.js";
import { armJobOfferFeel, JOB_OFFER_FEEL } from "./src/jobOfferFeel.js";
// Pointer-to-render feel primitive. Wiring it into main.js here is
// what turns `inputAcknowledgeLatency.ts` from a pure model into a
// SHIPPED runtime contract: the served page timestamps every real
// `pointerdown` at `performance.now()`, then closes the loop after
// `composer.render()` on the next rAF tick — one 60Hz frame budget,
// measured on the real DOM, exposed on `window.__game.input.
// getPointerToRenderLatencyReport()`. The harness projection
// (bootWindowGame.ts) exposes the SAME four methods over the same
// primitive so vitest and Playwright can pin the seam identically.
import { measurePointerToRenderLatency } from "./src/inputAcknowledgeLatency.ts";
// Runtime seam extractions (PR #1358) — the served page consumes the
// same primitives the harness's bootWindowGame.ts pins in tests. Import
// each symbol EXACTLY ONCE from its owning module (ES module rule; a
// duplicate binding is a parse-time SyntaxError that would black-screen
// the page). `createPersistHelpers` is the persistence-runtime factory
// that returns { buildPersistPayload, persist, persistAuthoritative }.
import {
  createStoragePersistence,
  createPersistHelpers,
  emptySave,
} from "./src/runtime/persistence.js";
import { attachRuntimeInputAdapters } from "./src/runtime/inputAdapters.js";
import { createCameraPoseSampler } from "./src/runtime/feedbackRuntime.js";

const canvas = document.querySelector("#scene");
const line = document.querySelector("#line");
const speaker = document.querySelector("#speaker");
const stateReadout = document.querySelector("#stateReadout");
const failureSting = document.querySelector(".failure-sting");
const packetButton = document.querySelector("#packetButton");
const routeChoice = document.querySelector("#routeChoice");
const acknowledgeRouteButton = document.querySelector("#acknowledgeRouteButton");
const skipRouteButton = document.querySelector("#skipRouteButton");
// #1372: the M-LOOP-E1 route/risk surface. The writer
// `renderRouteRiskChoice` stamps one `<button
// data-aftersign-tap-choice="…">` per offered action into this
// container on every renderText() pass while the packet-choice beat
// is live; the surface stays hidden (data-visible="false") off-beat.
const routeRiskChoice = document.querySelector("#routeRiskChoice");
// #1395: served-page container for computeOfferedJobs. renderText()
// stamps one `<button id="job-offer-<jobId>">` per selected job id at
// the packet-offered beat; hidden + cleared off-beat.
const offeredJobs = document.querySelector("#offeredJobs");
const deliverButton = document.querySelector("#deliverButton");
const soundButton = document.querySelector("#soundButton");
const resetButton = document.querySelector("#resetButton");
const movePad = document.querySelector("#movePad");
const movePadKnob = document.querySelector("#movePadKnob");
const impactBurstOverlay = document.querySelector("#recognitionImpactBurst");

const CONFIRM_FEEDBACK = INTERACTION_CONFIRM_FEEL;
const MEMORY_RECOGNITION_FEEDBACK = IO_RECOGNITION_BEAT_FEEDBACK;
const FAILURE_FEEDBACK = DEFAULT_FAILURE_STING_FEEL;
const MOVEMENT = DEFAULT_PLAYER_MOVEMENT_FEEL;
const MOBILE_MOVE_PAD = DEFAULT_MOBILE_MOVE_PAD_FEEL;

// Live read of the OS/browser reduced-motion preference. The CSS half of
// this contract already exists — index.html:402 gates the failure-sting
// overlay's shake keyframes under `@media (prefers-reduced-motion: reduce)`.
// The JS half was the gap #1188 addresses: `failureStingEnvelopeAt` grew
// a `{ reducedMotion }` option that zeroes wobble/cameraKick/hudShake
// (keeping flash + hudDrop for a crisp acknowledgement), but no call
// site was passing it, so the shipped Three.js camera/HUD offsets still
// shook on reduced-motion users.
//
// The reader is factored out (aftersign/src/reducedMotionPreference.js)
// so it can CACHE the current answer and subscribe to the MediaQueryList's
// `change` event — that's how DevTools "Emulate CSS media feature" toggles
// land mid-run without re-querying matchMedia (and allocating a new
// MediaQueryList) every frame. The factory also guards SSR / jsdom
// environments where matchMedia may be missing, so the boot path stays
// safe under the pure/typecheck bundles that import main.js transitively.
const reducedMotionPreference = createReducedMotionPreference();
const prefersReducedMotion = () => reducedMotionPreference.read();

const params = new URLSearchParams(window.location.search);
const slot = params.get("slot") || "local";
const storageKey = `aftersign:kiosk-slice:${slot}`;
const sessionId = `session-${slot}`;
const breakMode = window.__FLAGSHIP_BREAK_MODE || params.get("breakMode") || "";

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const { readStored, writeStored } = createStoragePersistence({
  storage: window.localStorage,
  storageKey,
});

// Io's trust posture is a pure function of the delivery outcome
// (#564 test #1 asserts it; Phase 3 #566 grows the rest of npcs.io):
// sealed -> trusted-seal, opened -> useful-breach, unknown -> untested.
const trustPostureForOutcome = (outcome) =>
  outcome === "sealed" ? "trusted-seal" : outcome === "opened" ? "useful-breach" : "untested";

const localStored = readStored();
const bootstrapPlayerId = localStored?.player?.id || "local-slice-player";
const stored = await readAuthoritativeSave({
  slot,
  playerId: bootstrapPlayerId,
}).catch(() => null) || localStored;
const packetIntent = new PacketIntentController();

const orraMemoryFromStored = coerceOrraRecognitionMemory(stored?.npcs?.orra?.memory);
const orraLineFromStored = selectOrraRecognitionLine(orraMemoryFromStored);

const state = {
  slug: "aftersign",
  scene: {
    // Contract-canonical scene identity (e2e-shared asserts these —
    // #564 Phase 1; the old dev id "io-kiosk-rainline" predated the
    // shared contract and nothing else referenced it).
    id: "io-night-post-kiosk",
    act: "act-1-seal",
    // Flipped true once listeners + first render are wired (boot tail)
    // — the harness's "safe to drive input" signal.
    ready: false,
    beat: canonicalFlagshipBeat(stored?.beat) ?? "packet-offered",
  },
  story: {
    currentNpcId: null,
    memoryBeat: null,
  },
  delivery: {
    id: "blue-packet",
    outcome: stored?.delivery?.outcome || "unknown",
  },
  player: {
    id: "local-slice-player",
    name: stored?.player?.name ?? null,
    flags: {
      io_intro_seen: false,
      ...(stored?.player?.flags ?? {}),
    },
    x: stored?.player?.x ?? -1.8,
    z: stored?.player?.z ?? 1.15,
    // Fresh slots start facing the kiosk (which sits at -z from the
    // player's spawn at z=1.15). facingRadians=π means forward=(0,-1),
    // so the trailing camera lands at z ≈ 1.15 + 6.15 = 7.30 — matches
    // the intended `camera.position.set(0, 2.25, 7.6)` at scene init
    // (no snap on frame one) and satisfies the kiosk-scene-init
    // contract's `cameraRig.position.z > 0` assertion. The old
    // default (0) faced +z, away from the kiosk, and drove the rig
    // to z ≈ -5.0 while the three.js camera sat at +7.6 — reviewer
    // on #772 flagged that snap as the real bug behind the red spec.
    facingRadians: stored?.player?.facingRadians ?? Math.PI,
    // Second deliberate kiosk action (#736 M2-E1). Recorded by
    // the "acknowledge-kiosk" / "skip-kiosk-acknowledge" choices
    // at the packet-choice beat, BEFORE deliver-packet mints the
    // route-attention fact. `null` before the player has decided;
    // deliverPacket() normalizes null→"skipped" at fact-mint time
    // so a player who ignores the second action still lands on the
    // SKIPPED branch (the two-memory shape is invariant; only the
    // route-attention `object` differs).
    secondAction: stored?.player?.secondAction ?? null,
    // Return-tone posture the player struck at `io-return-recognition`
    // (PR #1236 — M-CONTINUE-E1). One of "kind" | "evasive" | "blunt",
    // captured from `data-return-reason` on the tapped recognition
    // button, and consulted by `lineForBeat()` at the following two
    // beats to pick Io's REPLY line and speak the HANDOFF line from
    // `buildIoContinueBeats(reason)`. `null` until the player picks;
    // in that (defensive) case `lineForBeat()` anchors to "evasive"
    // (the middle posture) so a mis-stamped tap doesn't silence Io.
    returnReason: stored?.player?.returnReason ?? null,
    // Route/risk memory fact (#1372 — M-LOOP-E1). Populated when
    // the player taps one of the offered-action buttons stamped by
    // `renderRouteRiskChoice` during the packet-choice beat; shape
    // is `AftersignRouteRiskMemory` from `routeRiskMemory.ts`
    // ({ lastRoute: "fast" | "safe", succeeded: boolean }) or null
    // before the first pick. Piggybacks on the persist payload's
    // `clone(state.player)` (see aftersign/src/runtime/persistence.js
    // :: buildPersistPayload), so the fact round-trips across reload
    // for free — no new persistence branch. `computeOfferedActions`
    // reads it on the next run to diverge the offered-action set.
    routeRisk: stored?.player?.routeRisk ?? null,
  },
  packet: {
    delivered: Boolean(stored?.packet?.delivered),
    route: stored?.packet?.route || null,
    sealed: stored?.packet?.sealed ?? true,
    deliveredAt: stored?.packet?.deliveredAt || null,
  },
  npcs: {
    io: {
      memory: stored?.memory ? clone(stored.memory) : [],
      lastLine: null,
      lastLineMemoryRefs: [],
    },
    orra: {
      memory: orraMemoryFromStored,
      lastLine: lineCopyForOrraLineId(orraLineFromStored.lineId),
      lastLineId: orraLineFromStored.lineId,
      // Mirrors npcs.io.lastLineMemoryRefs (docs/flagship/story-state-contract.md
      // §"npcs.io.lastLineMemoryRefs"): the ids the shipped line CITES, so the
      // served-page e2e (aftersign/e2e/orra-served-recognition.spec.ts, M-ORRA-E1
      // done-gate #1173) can assert Orra recognized the vigil action by reference
      // instead of by English text. On first-contact/no-memory this is [];
      // on the recognition line it carries the ORRA_RETURN_LINE_BY_ACTION[action]
      // id (e.g. "orra_return_lit_vigil"). Kept in lockstep with lastLineId at
      // every mint/select/restore/reset site below.
      lastLineMemoryRefs: orraLineFromStored.lineId === ORRA_FIRST_CONTACT_LINE_ID
        ? []
        : [orraLineFromStored.lineId],
    },
  },
  save: stored?.save ? { ...emptySave(), ...stored.save, dirty: false } : emptySave(),
  movement: {
    input: { x: 0, z: 0, source: "none", active: false },
    velocityX: 0,
    velocityZ: 0,
    lastStepMs: 0,
    lastVelocityMetersPerSecond: 0,
    fixedStepsLastFrame: 0,
    droppedStepMs: 0,
    contract: { ...MOVEMENT },
    mobilePad: {
      active: false,
      input: { x: 0, z: 0, knobX: 0, knobY: 0, magnitude: 0 },
      feel: { ...MOBILE_MOVE_PAD },
    },
  },
  cameraRig: null,
  interaction: {
    lastAction: null,
    lastPointer: null,
    kioskPulse: 0,
    confirmCount: 0,
    confirmStartedAt: null,
    failureStartedAt: null,
    confirmFeedback: {
      ...CONFIRM_FEEDBACK,
      active: false,
      remainingMs: 0,
    },
    // Live amplitudes for the recognition-beat camera envelope. Kept in
    // state (not the const) so the harness can zero them via
    // setRecognitionCameraEnvelope and prove the durable beat reports
    // MEASURED motion, not canned contract literals.
    recognitionFeedback: {
      ...MEMORY_RECOGNITION_FEEDBACK,
    },
    // Snippet-authored feel cue that came with the SELECTED
    // recognition-beat line — mirrored here so the harness / dev
    // overlays can read the exact ms/degrees/alphas that drove the
    // DOM envelope this beat. Null off-beat; populated by
    // syncIoLine() when state.scene.beat === "io-return-recognition"
    // from the SAME snippet that supplied `lastLine` + `lastLineMemoryRefs`
    // (one snippet, one truth — no drift between line, refs, and feel).
    // Consumed by:
    //   1. `--io-recognition-*` CSS custom properties (documentElement),
    //      which the served surface reads to drive camera-dolly /
    //      vignette / bloom / line-reveal envelopes;
    //   2. window.__game.npcs.io.lastLineFeelCue (see publishState) —
    //      the e2e io-recognition-dialogue-snippets spec asserts the
    //      shipped tier's numbers against the snippet contract.
    recognitionSnippetFeelCue: null,
    failureFeedback: {
      ...FAILURE_FEEDBACK,
      active: false,
      remainingMs: 0,
    },
    packetIntent: packetIntent.snapshot(),
    // Post-release verdict from evaluatePacketIntent (sample-stream
    // helper, sibling to the live controller). The controller owns the
    // frame-by-frame outcome pinned by the 450/14 e2e; this field is
    // the OFF-LINE reduction of the same gesture — one open/preserve/
    // cancel verdict + reason + measured (elapsedMs, dragPx). Populated
    // by `packetRelease`; null until the first gesture completes and
    // reset on `packetIntent.reset()`. Exposed on `window.__game` so
    // the harness / dev overlays can inspect what the pure evaluator
    // said about the gesture the controller just committed — divergence
    // between the two is a feel-drift signal.
    packetIntentEvaluation: null,
    // Post-beat analytic feel report (#1127/#1134) — null while a beat
    // runs or before the first beat; authored-feel peaks + framesDuringBeat
    // published at beat end.
    recognitionBeatReport: null,
  },
  _runtime: {
    audio: {
      unlocked: false,
      ambientStarted: false,
      lastCue: null,
      lastCueAt: null,
    },
  },
};

let statePublishVersion = 0;
let publishedStateVersion = -1;
let kioskSceneInitContract = null;

// Pointer-to-render probe state (SHIPPED consumer of
// `./src/inputAcknowledgeLatency.ts`). `pendingPointerIntents` maps
// pointerId → the `performance.now()` at which the real DOM
// `pointerdown` fired; `pointerLatencySamples` is the running report;
// `worstPointerLatencySample` keeps the max `deltaMs` seen this
// session so a regression stays loud even after a good sample lands
// after it. `pointerFrameBudgetMs` is 16.7 (one 60Hz frame, physically
// honest — the primitive's default rounds this to 16, so a 16ms
// sample lands INSIDE the budget with room for the fractional third).
//
// This is the "played, not driven" half of the contract: `pointerdown`
// on the served surface writes into `pendingPointerIntents`, and the
// render tick drains anything pending after `composer.render()` so
// every real tap the player performs is measured against the one-
// frame promise. The `window.__game.input.markPointerIntent /
// markPointerRendered` methods are the harness-side entry points that
// let a vitest spec exercise the same seam without dispatching a real
// PointerEvent — same primitive, same report shape.
const POINTER_TO_RENDER_FRAME_BUDGET_MS = 16.7;
const pendingPointerIntents = new Map();
let pointerLatencySamples = [];
let worstPointerLatencySample = null;

const resetPointerToRenderLatency = () => {
  pendingPointerIntents.clear();
  pointerLatencySamples = [];
  worstPointerLatencySample = null;
};

const foldPointerLatencySample = (pointerAtMs, renderedAtMs, pointerId) => {
  const id = `pointer-${pointerId}`;
  const measurement = measurePointerToRenderLatency(
    { id, receivedAtMs: pointerAtMs },
    { id, renderedAtMs },
    POINTER_TO_RENDER_FRAME_BUDGET_MS,
  );
  const sample = {
    pointerAtMs: measurement.receivedAtMs,
    renderedAtMs: measurement.renderedAtMs,
    deltaMs: measurement.latencyMs,
    frameBudgetMs: measurement.frameBudgetMs,
    withinBudget: measurement.withinOneFrame,
  };
  pointerLatencySamples.push(sample);
  if (
    worstPointerLatencySample === null
    || sample.deltaMs > worstPointerLatencySample.deltaMs
  ) {
    worstPointerLatencySample = sample;
  }
  return sample;
};

const markPointerIntent = (input) => {
  if (!input || typeof input.pointerAtMs !== "number" || typeof input.pointerId !== "number") {
    return;
  }
  pendingPointerIntents.set(input.pointerId, input.pointerAtMs);
};

const markPointerRendered = (input) => {
  if (!input || typeof input.renderedAtMs !== "number" || typeof input.pointerId !== "number") {
    return;
  }
  const pointerAtMs = pendingPointerIntents.get(input.pointerId);
  if (pointerAtMs === undefined) {
    // No matching intent — orphaned render signal. Silently ignore;
    // a jittery renderer firing an extra `rendered` after a reset
    // shouldn't crash the probe.
    return;
  }
  pendingPointerIntents.delete(input.pointerId);
  foldPointerLatencySample(pointerAtMs, input.renderedAtMs, input.pointerId);
};

const drainPointerIntentsForRenderedFrame = (renderedAtMs) => {
  if (pendingPointerIntents.size === 0) {
    return;
  }
  // Snapshot the pending entries so a fold that mutates the map
  // doesn't invalidate the iterator on browsers that don't tolerate
  // in-flight deletion.
  const drained = Array.from(pendingPointerIntents.entries());
  pendingPointerIntents.clear();
  for (const [pointerId, pointerAtMs] of drained) {
    foldPointerLatencySample(pointerAtMs, renderedAtMs, pointerId);
  }
};

const getPointerToRenderLatencyReport = () => {
  const latest = pointerLatencySamples[pointerLatencySamples.length - 1];
  const report = {
    samples: pointerLatencySamples.slice(),
  };
  if (latest) {
    report.latest = latest;
  }
  if (worstPointerLatencySample) {
    report.worst = worstPointerLatencySample;
  }
  return report;
};

// #957: Io's returning-session boot line. Computed once at boot (below,
// after `visibilitychange` wiring) from the durable delivery-outcome
// and route-attention memory facts, then consulted by `lineForBeat` so
// the render path speaks the returning line — not the fresh "clean
// handoff" copy — until the player advances past the persisted boot
// beat. Once `state.scene.beat` diverges from `ioReturningBootBeat`
// (e.g. after "return-to-io" transitions to `io-return-recognition`),
// this override drops out and the beat's own verbatim line wins.
let ioReturningBootLine = null;
let ioReturningBootBeat = null;
let ioSecondPacketResponseLine = null;

// Recompute the returning-session boot override from the CURRENT state
// (memory facts + scene beat). Called at module init AND from
// reloadFromSave()'s restore branch — before this was shared, only a
// real page reload re-armed the override, so the in-page
// input.forceReload() of a delivered save landed at packet-delivered
// speaking the fresh "clean handoff" line instead of recognizing the
// returning player (flagship-reload-beat-regression :258 red on main).
const armReturningSessionBootLine = (delivered) => {
  ioReturningBootLine = null;
  ioReturningBootBeat = null;
  if (!delivered) {
    return;
  }
  // Per the #957 contract above: the returning line never overrides
  // beats that already speak their own memory-minted copy. Originally
  // this guard only skipped `io-return-recognition`, but PR #1234 made
  // `choose-return-tone` durably persist `return-tone-choice` (via
  // forceSave), and `io-next-job` is reachable from a reload right
  // after — both beats own their verbatim REPLY / HANDOFF lines out
  // of `buildIoContinueBeats(reason)`. Without extending the skip
  // list, a reload at either persisted beat would arm the boot
  // override and clobber the beat's own line with the returning
  // recognition copy (Soren PR #1238 review).
  if (
    state.scene.beat === "io-return-recognition"
    || state.scene.beat === "return-tone-choice"
    || state.scene.beat === "io-next-job"
  ) {
    return;
  }
  const outcomeFact = state.npcs.io.memory.find(
    (fact) => fact?.kind === "delivery-outcome",
  );
  ioReturningBootLine = outcomeFact
    ? chooseIoReturningSessionLine({
        packetOutcome: outcomeFact.object,
        routeAttention:
          secondActionFromMemory(state.npcs.io.memory) === SECOND_ACTION.DONE
            ? "listened"
            : "skipped",
      })
    : chooseIoReturningSessionLine({});
  ioReturningBootBeat = state.scene.beat;
};

// Vite's default MODE values are `development` / `production` / `test`;
// the FlagshipGameSurface contract (docs/flagship/story-state-contract.md
// + e2e-shared/flagshipStoryStateContract.ts:88) narrows to the shorter
// `dev` / `prod` / `test`. Map here so `build.mode` is contract-shaped
// regardless of how vite was invoked (dev server, preview, or an
// explicit --mode override).
const buildMode = (() => {
  const rawMode = import.meta.env.MODE;
  if (rawMode === "production") return "prod";
  if (rawMode === "development") return "dev";
  if (rawMode === "test" || rawMode === "dev" || rawMode === "prod") return rawMode;
  // Unknown custom mode — treat as dev so the surface stays inside the
  // contract union rather than leaking a raw vite value.
  return "dev";
})();

const markStateDirty = () => {
  statePublishVersion += 1;
};

const setTextContentIfChanged = (node, value) => {
  if (node.textContent !== value) {
    node.textContent = value;
  }
};

let audioContext;
let ambientGain;
let rainNoise;
let rainFilter;
let kioskHum;
let kioskHumGain;

const lineForBeat = () => {
  // #957: If a returning-session boot line was computed at module init
  // (delivered save, restored via readAuthoritativeSave / readStored),
  // speak it while the scene is still at the persisted boot beat. As
  // soon as the player advances (setBeat mutates state.scene.beat away
  // from the recorded ioReturningBootBeat), the guard misses and the
  // next branch's own verbatim-asserted copy wins — the returning line
  // never overrides a downstream beat like `io-return-recognition`.
  if (
    ioReturningBootLine !== null
    && ioReturningBootBeat !== null
    && state.scene.beat === ioReturningBootBeat
  ) {
    return ioReturningBootLine;
  }

  if (state.scene.beat === "packet-choice") {
    return state.packet.sealed
      ? "Good. Some doors only open for people who can carry a secret without looking inside."
      : "You opened it. The route still glows, but now the city knows curiosity got there first.";
  }

  if (state.scene.beat === "packet-delivered") {
    return "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";
  }

  if (state.scene.beat === "return-tone-choice") {
    // M-CONTINUE-E1 (PR #1236): shipped consumer of
    // `story/ioContinueBeats.ts`. The player has just tapped one of
    // three recognition-beat tone buttons — that stamped
    // `state.player.returnReason` on the RECOGNITION click handler.
    // Here we render Io's REPLY line for that posture (the [0] entry
    // in `buildIoContinueBeats(reason)`) into `#line`, so the same
    // reason token that drives the return-tone FEEL surface
    // (returnToneChoiceFeel.ts) also drives Io's WORDS — one axis,
    // one lookup, no drift between voice and feel.
    //
    // Defensive: if no reason is recorded (shouldn't happen — this
    // beat is only reachable via a stamped tone tap), anchor to
    // "evasive" (the middle posture), matching `getIoReturnToneReply`'s
    // own fallback rule.
    const reason = state.player.returnReason ?? "evasive";
    return buildIoContinueBeats(reason)[0].line;
  }

  if (state.scene.beat === "io-next-job") {
    if (ioSecondPacketResponseLine) {
      return ioSecondPacketResponseLine;
    }
    // M-CONTINUE-E1 (PR #1236): shipped consumer of
    // `story/ioContinueBeats.ts`. The HANDOFF line (Io hands the
    // player the red tag → Saint Orra) is the [1] entry in
    // `buildIoContinueBeats(reason)` — invariant across postures,
    // but sourced through the same module as the reply so a rewrite
    // of the beat's copy lands the moment the module changes.
    //
    // Shipped consumer of `ioMemoryResponseLinesFor` (PR #1228): the
    // player has TAPPED through delivery + return-tone to land here,
    // so this is the first beat where Io speaks with a memory of who
    // just walked back in. We prepend the dispatcher's authored
    // reflection lines to the next-job pitch — one string, so
    // `#line` still shows a single flowing utterance rather than a
    // list. When the player has no durable facts (defensive: shouldn't
    // happen at this beat, but honored so the surface stays crash-
    // free), the handoff line still speaks (`remembersNoDurableFact`).
    //
    // Shipped consumer of `ioSecondPacketCopy.ts` (#1322): after the
    // handoff, Io now visibly offers the second packet on the served
    // page. The player's return posture maps to the copy module's
    // gentle / guarded / defiant variants, and the same player name
    // already persisted on state is threaded into the address line.
    const reflection = ioMemoryResponseLinesFor({
      playerFlags: state.player.flags,
      npcMemoryFacts: state.npcs.io.memory,
    })
      .map((entry) => entry.text)
      .join(" ");
    // Shipped consumer of `findAftersignNpcMemoryRecallLine` (PR #1343).
    // Io's authored recall line for the packet fork the player just
    // committed — "You opened it..." vs "Still sealed. Good..." —
    // rides on the SAME join as `reflection` + `handoffLine` inside
    // this branch (the terminal-handoff beat resolved a few lines
    // above), so the same tap that stamps `#line` also renders the
    // recall assertion text on the served page. `state.packet.sealed`
    // is the durable fork the module keys on (see the dialogue table
    // in `apps/web/src/aftersign/npcMemoryRecallDialogue.ts`).
    const recallRemembers = state.packet.sealed ? "packet-sealed" : "packet-opened";
    const recallEntry = findAftersignNpcMemoryRecallLine({
      npcId: "io",
      remembers: recallRemembers,
    });
    const recallLine = recallEntry ? recallEntry.line : null;
    const handoffLine = ioNextJobLine();
    const secondPacketCopy = selectIoSecondPacketCopyForReturnReason({
      returnReason: state.player.returnReason,
      playerName: state.player.name,
    });
    const secondPacketLine = secondPacketCopy.lines.join(" ");
    return [reflection, recallLine, handoffLine, secondPacketLine].filter(Boolean).join(" ");
  }

  if (state.scene.beat === "io-return-recognition") {
    // Red-guard hook (#653): wrong-io-line deliberately swaps the
    // recognition line so the harness can prove it would catch a
    // line/outcome mismatch. No-op when breakMode is "".
    //
    // Red-guard hook (#1180 M-ORRA-E1): orra-io-contamination COUPLES
    // Io's returning-session line to Orra memory presence — the exact
    // contamination the isolation invariant forbids. When active AND
    // Orra has recognized (lit/spared vigil → state.npcs.orra.memory
    // non-empty), invert speakAsSealed so the shipped Io line ceases
    // to match the durable packet outcome. This is the ONLY code path
    // that ever reads Orra state from an Io-line branch, and it is
    // strictly gated on the break mode — default lane runs are byte
    // -identical to pre-#1180 behavior (isolation holds), which is
    // the property the served-page e2e (flagship-surface-contract.spec.ts)
    // asserts green by default and RED under this mode. Feeds done-gate
    // #1173.
    const rememberedSealed = state.packet.sealed;
    const orraContaminated =
      breakMode === "orra-io-contamination"
      && Array.isArray(state.npcs.orra?.memory)
      && state.npcs.orra.memory.length > 0;
    const speakAsSealed =
      breakMode === "wrong-io-line" || orraContaminated
        ? !rememberedSealed
        : rememberedSealed;
    const snippets = buildIoRecognitionDialogueSnippets({
      playerId: state.player.id,
      packetSealed: speakAsSealed,
      memory: state.npcs.io.memory,
    });
    // Selector needs `memory` to gate deep-recall on the real
    // second-action (route-attention `object === "done"`). Without
    // this the fallback path always speaks the returning tier.
    return selectIoRecognitionDialogueLine(snippets, { memory: state.npcs.io.memory }).line;
  }

  return "Keep it sealed if you want the city to trust you. I will remember which version of you touches that blue kiosk.";
};

const memoryFacts = () => {
  const outcome = state.packet.sealed ? "sealed" : "opened";
  // Read the SECOND ACTION from the durable player-input flag, not
  // from the beat. deliverPacket() runs while beat==="packet-choice"
  // so a beat-derived value would be a constant. normalizeSecondAction
  // maps `null` (player never acknowledged) → SKIPPED — that's the
  // absence-of-action branch, and the reason both memory-length
  // outcomes are 2 (fact SHAPE is invariant; only fact `object` differs).
  const secondAction = normalizeSecondAction(state.player.secondAction);
  return {
    packetOutcomeFact: buildPacketOutcomeMemoryFact({
      outcome,
      sessionId,
    }),
    secondActionFact: buildSecondActionMemoryFact({
      secondAction,
      sessionId,
    }),
    secondAction,
  };
};

// PR #1249 (Soren review) — durability stamp for the `io-next-job`
// beat. `choose('ask-for-next-job')` now `await forceSave()`s right
// after `setBeat('io-next-job')`, so the persisted payload must
// carry an unambiguous record that the player parked at this beat.
// The stamp lives under `save.ioNextJob` and is READ back in
// `reloadFromSave` below: if `parked === true` and `playerId`
// matches, the restore path snaps `state.scene.beat` to
// `io-next-job` and re-hydrates `state.player.returnReason` from
// the stamp — that's what makes the field load-bearing rather than
// a write-only ornament (Soren's second review point).
//
// Pure: no closure over live state; every input is passed by the
// caller so `buildPersistPayload` remains the single owner of what
// gets snapshotted.
const { buildPersistPayload, persist, persistAuthoritative } = createPersistHelpers({
  state,
  slot,
  clone,
  markStateDirty,
  writeStored,
  writeAuthoritativeSave,
});

// Apply an authored per-tier feel cue (or clear it) as CSS custom
// properties on documentElement.  These `--io-recognition-*` vars are
// READ by concrete CSS rules in aftersign/index.html — the ones added
// alongside this writer in PR #1139 (Mara's review):
//   • body::after — vignette overlay opacity = vignetteAlpha, fade
//     transition uses lineRevealDelayMs + lineRevealDurationMs + easing
//   • .panel — transform composes translateZ(cameraDollyCm * 0.6px) +
//     rotateY(cameraYawDegrees) with the existing haptic-scale, and
//     box-shadow's warm ring is modulated by bloomAlpha
//   • .panel + .line — transition timing reads the reveal window vars
//   • .hud — background transition reads durationMs (envelope-wide)
// One snippet, one truth: the tier the dialogue selector chose drives
// the numbers the shipped surface consumes.  This is NOT the older
// `--recognition-*` namespace (sign-glow / seal-glow / warmth /
// rain-rim-alpha / haptic-scale) written by recognition-dom-feedback.js
// — that's the runtime feedback envelope; the io-recognition-* vars
// carry the AUTHORED-per-tier motion values.
// Off-beat we zero them so nothing bleeds out of the beat.
const applyIoRecognitionFeelCueVars = (cue) => {
  const root = document.documentElement;
  if (!cue) {
    root.style.setProperty("--io-recognition-duration-ms", "0ms");
    root.style.setProperty("--io-recognition-camera-dolly-cm", "0");
    root.style.setProperty("--io-recognition-camera-yaw-deg", "0");
    root.style.setProperty("--io-recognition-vignette-alpha", "0");
    root.style.setProperty("--io-recognition-bloom-alpha", "0");
    root.style.setProperty("--io-recognition-bloom-ring-alpha", "0");
    root.style.setProperty("--io-recognition-line-reveal-delay-ms", "0ms");
    root.style.setProperty("--io-recognition-line-reveal-duration-ms", "0ms");
    root.style.setProperty("--io-recognition-easing", "linear");
    return;
  }
  root.style.setProperty("--io-recognition-duration-ms", `${cue.durationMs}ms`);
  root.style.setProperty("--io-recognition-camera-dolly-cm", `${cue.cameraDollyCm}`);
  root.style.setProperty("--io-recognition-camera-yaw-deg", `${cue.cameraYawDegrees}`);
  root.style.setProperty("--io-recognition-vignette-alpha", `${cue.vignetteAlpha}`);
  root.style.setProperty("--io-recognition-bloom-alpha", `${cue.bloomAlpha}`);
  // Pre-resolve the warm-ring alpha (bloomAlpha * 3.6, clamped) so the
  // .panel box-shadow can consume a plain number in legacy rgba().
  // calc() inside a color function's alpha slot invalidates the whole
  // box-shadow declaration on engines that reject it — the recurring
  // bloom-regex CI failure on PR #1139. Resolving here keeps the CSS
  // grammar-safe on every engine.
  root.style.setProperty(
    "--io-recognition-bloom-ring-alpha",
    `${Math.min(1, cue.bloomAlpha * 3.6)}`,
  );
  root.style.setProperty("--io-recognition-line-reveal-delay-ms", `${cue.lineRevealDelayMs}ms`);
  root.style.setProperty("--io-recognition-line-reveal-duration-ms", `${cue.lineRevealDurationMs}ms`);
  root.style.setProperty("--io-recognition-easing", cue.easing);
};

const feelCueEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.durationMs === b.durationMs
    && a.holdFrames === b.holdFrames
    && a.cameraDollyCm === b.cameraDollyCm
    && a.cameraYawDegrees === b.cameraYawDegrees
    && a.vignetteAlpha === b.vignetteAlpha
    && a.bloomAlpha === b.bloomAlpha
    && a.lineRevealDelayMs === b.lineRevealDelayMs
    && a.lineRevealDurationMs === b.lineRevealDurationMs
    && a.easing === b.easing
  );
};

const syncIoLine = () => {
  // At the recognition beat, line / memoryRefs / feelCue are all
  // minted from the SAME snippet the dialogue module selected — one
  // source of truth per tier. Deep-recall (both delivery-outcome AND
  // route-attention remembered) carries two refs; returning carries
  // one; first-meeting carries zero. Only at this beat does a feelCue
  // exist; off-beat it's null and the CSS envelope zeroes out.
  let nextMemoryRefs = [];
  let nextFeelCue = null;
  let nextLine;
  if (state.scene.beat === "io-return-recognition") {
    const rememberedSealed = state.packet.sealed;
    const speakAsSealed = breakMode === "wrong-io-line" ? !rememberedSealed : rememberedSealed;
    const snippets = buildIoRecognitionDialogueSnippets({
      playerId: state.player.id,
      packetSealed: speakAsSealed,
      memory: state.npcs.io.memory,
    });
    const selected = selectIoRecognitionDialogueLine(snippets, {
      memory: state.npcs.io.memory,
    });
    nextLine = selected.line;
    nextMemoryRefs = [...selected.memoryRefs];
    nextFeelCue = { ...selected.feelCue };
    // Return-tone feel — REAL call site (PR #1205 re-review). The
    // `applyReturnToneFeel` window seam defined below is now
    // ACTUALLY INVOKED every time the render path hits the
    // recognition beat, not just re-exported for the harness. The
    // posture is a pure projection of durable state already known
    // at this point:
    //   • !sealed              → "evasive" (curiosity got the packet
    //                            opened — a return that ducks the
    //                            question)
    //   • sealed + listened    → "kind"    (delivered clean AND
    //                            acknowledged the route — soft press)
    //   • sealed + skipped     → "blunt"   (clean handoff, no
    //                            acknowledgement — defiant press)
    // Same three-value axis as `AftersignReturnReason` (see
    // ioVoiceContract.ts + returnToneChoiceFeel.ts), so voice and
    // feel share one token. Firing the same `window.__game`
    // property the harness / e2e drive means the shipped page and
    // the tests can't disagree about what "kind" means on the DOM
    // surface — the seam is proved runnable, not just defined.
    const routeAttention =
      secondActionFromMemory(state.npcs.io.memory) === SECOND_ACTION.DONE
        ? "listened"
        : "skipped";
    const returnToneReason = !state.packet.sealed
      ? "evasive"
      : routeAttention === "listened"
        ? "kind"
        : "blunt";
    if (
      typeof window !== "undefined"
      && window.__game
      && typeof window.__game.applyReturnToneFeel === "function"
    ) {
      window.__game.applyReturnToneFeel(returnToneReason);
    }
  } else {
    nextLine = lineForBeat();
  }
  if (
    state.npcs.io.lastLine !== nextLine
    || state.npcs.io.lastLineMemoryRefs.length !== nextMemoryRefs.length
    || state.npcs.io.lastLineMemoryRefs.some((ref, index) => ref !== nextMemoryRefs[index])
    || !feelCueEqual(state.interaction.recognitionSnippetFeelCue, nextFeelCue)
  ) {
    state.npcs.io.lastLine = nextLine;
    state.npcs.io.lastLineMemoryRefs = nextMemoryRefs;
    state.interaction.recognitionSnippetFeelCue = nextFeelCue;
    applyIoRecognitionFeelCueVars(nextFeelCue);
    markStateDirty();
  }
};

const syncPacketIntent = (snapshot = packetIntent.snapshot()) => {
  const progressValue = snapshot.progress.toFixed(3);
  if (document.documentElement.style.getPropertyValue("--packet-progress") !== progressValue) {
    document.documentElement.style.setProperty("--packet-progress", progressValue);
  }
  const ariaValue = Math.round(snapshot.progress * 100).toString();
  if (packetButton.getAttribute("aria-valuenow") !== ariaValue) {
    packetButton.setAttribute("aria-valuenow", ariaValue);
  }

  const currentIntent = JSON.stringify(state.interaction.packetIntent);
  const nextIntent = JSON.stringify(snapshot);
  if (currentIntent !== nextIntent) {
    state.interaction.packetIntent = clone(snapshot);
    markStateDirty();
  }
};

const setMoveInput = (x, z, source = "script") => {
  state.movement.input = normalizeMoveInput(x, z, source, MOVEMENT);
  publishState();
};

let mobileMovePadController = null;

const syncMobileMovePad = () => {
  if (!mobileMovePadController) {
    return;
  }
  state.movement.mobilePad = mobileMovePadController.snapshot();
  markStateDirty();
};

// `source` reuses the existing "touch" literal from MovementInputSource
// (aftersign/src/playerMovementFeel.ts) instead of introducing a new
// "touch-pad" string — Soren's nit on PR #1029. main.js is plain JS so a
// contract-drift would slip past typecheck; keep the union honest here.
const setMobileMovePadInput = (x, z, source = "touch") => {
  setMoveInput(x, z, source);
  syncMobileMovePad();
  publishState();
};

const stepMovement = (dt = MOVEMENT.fixedStepSeconds) => {
  const movementState = createPlayerMovementState({
    x: state.player.x,
    z: state.player.z,
    facingRadians: state.player.facingRadians,
    input: state.movement.input,
    velocityX: state.movement.velocityX,
    velocityZ: state.movement.velocityZ,
    lastStepMs: state.movement.lastStepMs,
    lastVelocityMetersPerSecond: state.movement.lastVelocityMetersPerSecond,
  });
  const result = stepPlayerMovementModel(movementState, dt, MOVEMENT);
  state.player.x = result.state.x;
  state.player.z = result.state.z;
  state.player.facingRadians = result.state.facingRadians;
  state.movement.velocityX = result.state.velocityX;
  state.movement.velocityZ = result.state.velocityZ;
  state.movement.lastStepMs = result.state.lastStepMs;
  state.movement.lastVelocityMetersPerSecond = result.state.lastVelocityMetersPerSecond;
  // Legacy single-step wrapper: by construction we ran exactly one
  // fixed step this call. Deriving from `lastStepMs > 0` was cosmetic
  // (a duration masquerading as a count) — happened to yield 1 for
  // any real step, 0 only if a caller passed dt=0. Set the count
  // directly so the field reads intent-first.
  state.movement.fixedStepsLastFrame = 1;
  state.movement.droppedStepMs = 0;
};

let movementAccumulator = 0;

const stepMovementFixed = (frameDt = MOVEMENT.fixedStepSeconds) => {
  const movementState = createPlayerMovementState({
    x: state.player.x,
    z: state.player.z,
    facingRadians: state.player.facingRadians,
    input: state.movement.input,
    velocityX: state.movement.velocityX,
    velocityZ: state.movement.velocityZ,
    lastStepMs: state.movement.lastStepMs,
    lastVelocityMetersPerSecond: state.movement.lastVelocityMetersPerSecond,
  });
  const result = stepPlayerMovementFixedUpdate(movementState, movementAccumulator, frameDt, MOVEMENT);
  state.player.x = result.state.x;
  state.player.z = result.state.z;
  state.player.facingRadians = result.state.facingRadians;
  state.movement.velocityX = result.state.velocityX;
  state.movement.velocityZ = result.state.velocityZ;
  state.movement.lastStepMs = result.state.lastStepMs;
  state.movement.lastVelocityMetersPerSecond = result.state.lastVelocityMetersPerSecond;
  state.movement.fixedStepsLastFrame = result.steps;
  state.movement.droppedStepMs = result.droppedSeconds * 1000;
  movementAccumulator = result.remainderSeconds;
  return result;
};

const cameraRigInput = (dtSeconds = MOVEMENT.fixedStepSeconds) => ({
  playerX: state.player.x,
  playerZ: state.player.z,
  facingRadians: state.player.facingRadians,
  velocityX: state.movement.velocityX,
  velocityZ: state.movement.velocityZ,
  dtSeconds,
});

const stepCameraRig = (dtSeconds = MOVEMENT.fixedStepSeconds) => {
  state.cameraRig = state.cameraRig
    ? stepKioskCameraRigModel(state.cameraRig, cameraRigInput(dtSeconds), DEFAULT_KIOSK_CAMERA_RIG)
    : createKioskCameraRigState(cameraRigInput(dtSeconds), DEFAULT_KIOSK_CAMERA_RIG);
  markStateDirty();
  publishState();
  return clone(state.cameraRig);
};

const assertFeelContract = () => {
  checkMobileMovePadFeel(MOBILE_MOVE_PAD);
  return checkPlayerMovementFeel(MOVEMENT);
};

const publishState = () => {
  syncIoLine();
  syncPacketIntent();
  // NOTE: Orra's lastLine/lastLineId are updated at the two places
  // that actually change Orra's memory or the player's beat with
  // Orra — the mint branch (`orraAction`) in handleChoice, and the
  // return-to-orra branch. Boot, reset, and restore also stamp them
  // from `selectOrraRecognitionLine(state.npcs.orra.memory)`. Doing
  // this INSIDE publishState was defensively re-derivable but ran on
  // every RAF tick (the runtime pumps publishState() from the tick
  // loop at ~60Hz) — an extra branch + string comparisons + a
  // potential `markStateDirty()` on the hot path for no correctness
  // gain. Keep the derivation at the memory-change sites where it
  // belongs; publishState stays read-only for the Orra lane.
  if (publishedStateVersion === statePublishVersion && window.__game) {
    return window.__game;
  }

  window.__game = {
    version: 1,
    slug: state.slug,
    build: { slug: state.slug, mode: buildMode },
    scene: { ...state.scene },
    story: clone(state.story),
    player: clone(state.player),
    packet: clone(state.packet),
    delivery: {
      id: "blue-packet",
      ...clone(state.delivery),
    },
    npcs: {
      io: {
        id: "io",
        displayName: "Io Vale",
        present: true,
        ...clone(state.npcs.io),
        memories: clone(state.npcs.io.memory),
        trustPosture: trustPostureForOutcome(state.delivery.outcome),
        // Player-keyed recognition dialogue snippets — three tiers
        // (first-meeting / returning / deep-recall) minted from Io's
        // durable memory. Published on every publishState() so the
        // io-recognition-dialogue-snippets e2e can assert tier order,
        // per-tier memoryRef counts, AND per-tier feelCue numbers
        // (durationMs / cameraDollyCm / cameraYawDegrees / etc.) that
        // drive the DOM envelope at the recognition beat.
        recognitionDialogueSnippets: buildIoRecognitionDialogueSnippets({
          playerId: state.player.id,
          packetSealed: state.packet.sealed,
          memory: state.npcs.io.memory,
        }),
        // The feelCue of the snippet the selector CHOSE this beat —
        // null off-beat, populated by syncIoLine() at
        // io-return-recognition. Same source as lastLine / lastLineMemoryRefs
        // so the served surface can't drift between "which line spoke"
        // and "how the beat felt".
        lastLineFeelCue: state.interaction.recognitionSnippetFeelCue,
      },
      orra: {
        id: "orra",
        displayName: "Orra",
        present: true,
        ...clone(state.npcs.orra),
        memories: clone(state.npcs.orra.memory),
      },
    },
    save: { ...state.save },
    movement: clone(state.movement),
    cameraRig: clone(state.cameraRig),
    sceneRig: clone(kioskSceneInitContract),
    interaction: {
      ...clone(state.interaction),
      recognitionDomFeedback: clone(recognitionDomFeedback),
      impactBurstParticles: clone(impactBurstParticles),
    },
    // Publish the runtime audio surface so the look/sound contract
    // spec can observe playKioskConfirm()'s stamped cue. Without
    // this the harness reads window.__game._runtime as undefined
    // and the audio half of the assertion (audioLastCue ===
    // 'packet-confirmed') can never satisfy. The closure's
    // state._runtime is stamped inside enableAudio()/
    // playKioskConfirm() but was previously invisible from the
    // outside; cloning it here mirrors every other published
    // sub-object so mutations after publishState() don't leak
    // back into the live state graph.
    _runtime: clone(state._runtime),
    getSnapshot: () => clone({
      version: 1,
      slug: state.slug,
      build: { slug: state.slug, mode: buildMode },
      scene: state.scene,
      story: state.story,
      player: state.player,
      packet: state.packet,
      delivery: {
        id: "blue-packet",
        ...state.delivery,
      },
      npcs: {
        io: {
          id: "io",
          displayName: "Io Vale",
          present: true,
          ...state.npcs.io,
          memories: state.npcs.io.memory,
          lastLineFeelCue: state.interaction.recognitionSnippetFeelCue,
          trustPosture: trustPostureForOutcome(state.delivery.outcome),
          recognitionDialogueSnippets: buildIoRecognitionDialogueSnippets({
            playerId: state.player.id,
            packetSealed: state.packet.sealed,
            memory: state.npcs.io.memory,
          }),
        },
        orra: {
          id: "orra",
          displayName: "Orra",
          present: true,
          ...state.npcs.orra,
          memories: state.npcs.orra.memory,
        },
      },
      save: state.save,
      movement: state.movement,
      cameraRig: state.cameraRig,
      interaction: {
        ...state.interaction,
        recognitionDomFeedback,
        impactBurstParticles,
      },
    }),
    reset,
    input: {
      choose,
      advance,
      waitForStoryIdle,
      forceSave,
      forceReload: reloadFromSave,
      setMoveInput,
      stepMovement,
      stepMovementFixed,
      stepCameraRig,
      packetPress,
      packetMove,
      packetRelease,
      packetTick,
      setConfirmCameraKick,
      setRecognitionCameraEnvelope,
      // Pointer-to-render feel-contract probe. Shape mirrors the
      // harness projection on `bootAftersignWindowGame` (see
      // `apps/web/src/aftersign/harness/bootWindowGame.ts`) so a
      // vitest consumer test and a Playwright played-through spec
      // read the same seam. `markPointerIntent` /
      // `markPointerRendered` let a harness caller drive the probe
      // without dispatching a real PointerEvent; on the shipped page
      // they're ALSO driven by the real `pointerdown` listener +
      // render tick installed below (`document.addEventListener
      // ("pointerdown", ...)` at boot; `drainPointerIntentsForRen-
      // deredFrame(now)` in the tick after `composer.render()`).
      // `getPointerToRenderLatencyReport()` returns
      // `{ samples[], latest?, worst? }` — where `worst` is the MAX
      // deltaMs seen this session so a regression stays loud.
      resetPointerToRenderLatency,
      markPointerIntent,
      markPointerRendered,
      getPointerToRenderLatencyReport,
    },
    assertFeelContract,
    deliverPacket: () => choose("deliver-packet"),
    enableAudio: () => enableAudio(),
    resetSliceSave: () => resetSliceSave(),
    /**
     * Return-tone press-envelope writer. Looks up the pinned feel
     * row for `reason` (one of "kind" / "evasive" / "blunt", the
     * same posture axis the voice memory thread uses) and stamps
     * its 11 CSS variables + dataset marker onto the
     * [data-aftersign-return-surface] node in index.html.
     *
     * Returns the applied feel row so a caller can chain (e.g.
     * schedule the matching audio cue with feel.audioCue.frequencyHz)
     * without a second lookup, or `null` when the surface node isn't
     * mounted (stripped DOM / test harness without a surface).
     *
     * This is the shipped consumer that turns
     * apps/web/src/aftersign/returnToneChoiceFeel.ts from a design
     * contract into runnable slice code — the served /aftersign/
     * page now writes the same 39 tuned numbers a "why did you come
     * back?" beat would consume, so the review that shipped the
     * module can point at a live seam, not a test-only harness.
     */
    applyReturnToneFeel: (reason) => {
      const surface = document.querySelector(
        AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
      );
      if (!surface) {
        return null;
      }
      return applyAftersignReturnToneChoiceFeel(surface, reason);
    },
    /**
     * Measure every mounted tap-choice surface
     * (`[data-aftersign-tap-choice]`) against the 44px minimum touch
     * target and return the per-surface report. Runtime consumer of
     * `apps/web/src/aftersign/tapChoiceFeel.ts` on the SHIPPED page:
     * the same seam the harness (`getTapChoiceFeelReport` on
     * `bootAftersignWindowGame`) exposes, but here it reads the real
     * served DOM — a renderer that ships a 40px button reds this
     * report before the player ever mis-taps. Fresh measurement each
     * call so a resize / mount / unmount between beats never sees a
     * stale rect. Never throws — the caller decides log/warn/fail.
     */
    getTapChoiceFeelReport: () => {
      return assertAftersignTapChoiceSurfaces(document);
    },
    getMobileTapTargetFeelReport: () => {
      const targets = Array.from(
        document.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
        (node) => {
          const rect = node.getBoundingClientRect();
          return {
            id: node.getAttribute("data-aftersign-tap-choice") ?? "tap-choice",
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        },
      );
      return measureTapTargetAdjacency(targets);
    },
    getJobOfferFeel: () => ({ ...JOB_OFFER_FEEL }),
    /**
     * Stamp the flagship tap-confirm envelope on the `[data-aftersign-
     * tap-choice="<choiceId>"]` button in the LIVE served DOM. Called
     * by each of the four committing click handlers (packet release,
     * acknowledge-kiosk, skip-kiosk-acknowledge, deliver-packet /
     * ask-for-next-job) BEFORE `choose(...)`, so the CSS variables
     * land on the exact element the finger touched — not on every
     * tap-choice surface in the tray. Returns the applied row for
     * callers that want to chain (audio cue, telemetry sample) without
     * a second table lookup; returns `null` when no matching surface
     * exists so the envelope silently no-ops on transitional beats.
     * Never throws — the FEEL projection must never break the STATE
     * update that follows.
     */
    applyTapConfirmFeel: (choiceId) => {
      try {
        const nodes = document.querySelectorAll(
          AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
        );
        for (const node of nodes) {
          if (node.getAttribute("data-aftersign-tap-choice") === choiceId) {
            return applyFlagshipTapConfirmFeel(node);
          }
        }
        // No matching surface — return the row so a caller that just
        // wants to schedule an audio cue still has the numbers.
        return FLAGSHIP_TAP_CONFIRM_FEEL;
      } catch {
        return null;
      }
    },
  };
  publishedStateVersion = statePublishVersion;
  // Expose the Orra first-name dialogue seam on the published
  // `window.__game`. Attached OUTSIDE the object literal so it
  // does not interfere with the `publishState()` re-emission
  // guard (`publishedStateVersion === statePublishVersion`) —
  // the seam is a stable function reference; it never needs to
  // rebuild per publish. Runtime consumer of
  // `apps/web/src/aftersign/orraFirstNameDialogue.ts`: resolves
  // the beat, stamps `#speaker` + `#line` with the joined lines,
  // and marks `[data-beat-id="orra-first-name"]` +
  // `[data-choice-id]` so a tap harness can locate the beat by
  // attribute (same vocabulary as `stampAftersignBeat` /
  // `stampAftersignChoice`). Returns the resolved beat (frozen)
  // so a caller can also read the `remembered` sentence for the
  // durable memory lane. Throws with a specific message on an
  // unknown choice — a garbled caller papered over here would
  // hide the bug before the beat lands.
  window.__game.renderOrraFirstNameDialogue = (choiceId) =>
    renderOrraFirstNameDialogue(document, choiceId);
  // #1372 — M-LOOP-E1 seams. `renderRouteRiskChoice` mounts /
  // re-mounts the two tappable route buttons against the shipped
  // `#routeRiskChoice` container, using the CURRENT
  // `state.player.routeRisk` fact to pick the offered-action set.
  // Callers (harness, dev overlays, or the served renderText loop)
  // get the same divergent set that the played surface renders.
  // `getOfferedActions` exposes the pure primitive so a caller can
  // pin the divergence without touching the DOM.
  window.__game.renderRouteRiskChoice = () => {
    if (!routeRiskChoice) return [];
    return renderRouteRiskChoice({
      container: routeRiskChoice,
      memory: state.player.routeRisk,
      onChoose: (action) => {
        let route = state.player.routeRisk?.lastRoute ?? "safe";
        let succeeded = true;
        if (action === "take-the-shortcut" || action === "carry-a-fragile-packet") {
          route = "fast";
          succeeded = true;
        } else if (action === "take-the-long-way") {
          route = "safe";
          succeeded = true;
        } else if (action === "repair-the-loss") {
          succeeded = false;
        }
        state.player.routeRisk = recordRouteRun({ route, succeeded });
        markStateDirty();
        persist({ dirty: true });
      },
    });
  };
  window.__game.getOfferedActions = () =>
    computeOfferedActions(state.player.routeRisk);
  return window.__game;
};

const renderText = () => {
  syncIoLine();
  stampAftersignBeat(line, state.scene.beat);
  setTextContentIfChanged(speaker, "Io");
  setTextContentIfChanged(line, state.npcs.io.lastLine);
  const isPacketChoiceBeat = state.scene.beat === "packet-choice";
  const isReturnRecognitionBeat = state.scene.beat === "io-return-recognition";
  const isReturnToneChoiceBeat = state.scene.beat === "return-tone-choice";
  const isNextJobBeat = state.scene.beat === "io-next-job";
  const routeChoiceVisible = isPacketChoiceBeat || isReturnRecognitionBeat || isReturnToneChoiceBeat || isNextJobBeat;
  if (routeChoice.dataset.visible !== String(routeChoiceVisible)) {
    routeChoice.dataset.visible = String(routeChoiceVisible);
  }

  // #1372 — M-LOOP-E1: the ROUTE/RISK choice is only offered at
  // the packet-choice beat (same beat as the route-memory
  // "listened / ran early" fork above). Off-beat the container is
  // hidden and its children cleared. On-beat the writer stamps one
  // `<button data-aftersign-tap-choice="<action>">` per offered
  // action, keyed off `state.player.routeRisk` (null on the first
  // run → two "recovery" actions; after a fast/safe pick the set
  // diverges). Each tap records the run + persists + re-renders.
  if (routeRiskChoice) {
    const routeRiskVisible = isPacketChoiceBeat;
    if (routeRiskChoice.dataset.visible !== String(routeRiskVisible)) {
      routeRiskChoice.dataset.visible = String(routeRiskVisible);
    }
    if (routeRiskVisible) {
      renderRouteRiskChoice({
        container: routeRiskChoice,
        memory: state.player.routeRisk,
        onChoose: (action) => {
          // Map the offered action back to the {route, succeeded}
          // shape the memory fact wants. "take-the-shortcut" and
          // "carry-a-fragile-packet" record a successful fast run;
          // "take-the-long-way" a successful safe run;
          // "repair-the-loss" records a failed run on whatever
          // route the last one used (default: safe — the recovery
          // path).
          let route = state.player.routeRisk?.lastRoute ?? "safe";
          let succeeded = true;
          if (action === "take-the-shortcut" || action === "carry-a-fragile-packet") {
            route = "fast";
            succeeded = true;
          } else if (action === "take-the-long-way") {
            route = "safe";
            succeeded = true;
          } else if (action === "repair-the-loss") {
            succeeded = false;
          }
          state.player.routeRisk = recordRouteRun({ route, succeeded });
          markStateDirty();
          persist({ dirty: true });
          renderText();
        },
      });
    } else if (routeRiskChoice.firstChild) {
      while (routeRiskChoice.firstChild) {
        routeRiskChoice.removeChild(routeRiskChoice.firstChild);
      }
    }
  }

  // #1395 — computeOfferedJobs served render.
  //
  // Mirrors the #routeRiskChoice surface right above: on-beat we
  // stamp one button per id `computeOfferedJobs(memory)` returns
  // into `#offeredJobs`; off-beat the surface is hidden and its
  // children cleared. The `PlayerMemory` we hand the primitive is
  // derived from the durable `state.packet.delivered` flag — a
  // returning player who already completed a delivery reaches
  // `priorOutcome:"completed"` and the primitive returns
  // `COMPLETED_JOB_IDS` (`job-night-transfer` +
  // `job-signed-receipt`); a first-visit player passes undefined
  // memory and the primitive returns `[SAFE_DEFAULT_JOB_ID]`
  // (`job-safe-delivery`). Same discipline as the sibling
  // route-risk surface — no new persistence branch, no drift with
  // the harness's `deriveOfferedJobsPlayerMemory` mapping
  // (`interactionCount >= 1 → priorOutcome:"completed"` is the
  // same "returning player" signal, expressed here directly
  // against the durable delivery flag the served state already
  // carries).
  //
  // The button id is `job-offer-<jobId>` — the exact selector
  // shape the sibling e2e (aftersign/e2e/job-offers-played.spec.ts)
  // asserts. `data-aftersign-tap-choice="offer-<jobId>"` slots the
  // button into the shipped tap-choice vocabulary so a tap harness
  // walking that selector picks these up without a fork.
  const isPacketOfferedBeat = state.scene.beat === "packet-offered";
  if (offeredJobs) {
    if (offeredJobs.dataset.visible !== String(isPacketOfferedBeat)) {
      offeredJobs.dataset.visible = String(isPacketOfferedBeat);
    }
    if (isPacketOfferedBeat) {
      // Soren review on PR #1396: the signal source must be a CAREER
      // signal ("has the player ever completed a delivery"), not the
      // per-packet `state.packet.delivered` flag ("is THIS packet
      // delivered"). The next-packet loop branch (~line 1899 below)
      // resets `state.packet = { delivered: false, ... }` BEFORE
      // `setBeat("packet-offered")`, so at the re-entered
      // `packet-offered` beat `state.packet.delivered` is already
      // false → `computeOfferedJobs(undefined)` returns the safe-
      // default set instead of the completed set. Inverts the spec's
      // second-lap assertions deterministically.
      //
      // `state.npcs.io.memory` accumulates memory facts on delivery
      // (packet-outcome fact minted by deliverPacket) and is NOT wiped
      // by the loop reset — matching the harness's
      // `deriveOfferedJobsPlayerMemory` (`interactionCount >= 1`),
      // which is exactly this career-level "player has interacted"
      // signal. One axis, no drift with the harness mapping.
      const offeredJobsMemory = state.npcs.io.memory.length > 0
        ? { priorOutcome: "completed" }
        : undefined;
      const offers = selectIoJobOffers(offeredJobsMemory);
      // PR #1422 — M-LOOP memory posture consumed by
      // `mloop-copy.js`. Different axis than `offeredJobsMemory`
      // above (that one gates SELECTION — which jobIds are offered;
      // this one gates the per-offer ACTION AUTHORING — fresh /
      // returning / deep-recall — off the durable delivery outcome).
      // A durable delivery-outcome fact exists → returning /
      // deep-recall; no memory yet → fresh (via the module's
      // `memoryGateFor` default).
      const packetOutcomeFactObject = state.npcs.io.memory.find(
        (fact) => fact?.kind === "delivery-outcome",
      )?.object;
      const mloopMemory = packetOutcomeFactObject
        ? { packetOutcome: packetOutcomeFactObject }
        : {};
      // Signature-gated re-render: renderText() runs on EVERY rAF tick
      // (~60Hz, see the tick loop that calls renderText()+publishState()
      // per frame). A naive wipe-and-rebuild replaces the
      // `<button id="job-offer-*">` DOM nodes every ~16ms. That churn
      // broke Playwright's actionability stability check on the sibling
      // `job-offers-played.spec.ts` `safeOffer.click()` — the locator
      // resolves each retry to a fresh node with a fresh bounding box,
      // so "same position across two consecutive frames" never converges
      // and the click times out (Soren's #1424 blocking review —
      // "webServer boot" was a false diagnosis; the run reached the
      // click, timed out, and retries:3 exhausted before results.json
      // was flushed, which is why the failure-summary step reported
      // "results.json not found").
      //
      // Fix: compute an offer signature (`id:risk` pairs joined) and
      // only wipe + rebuild when it CHANGES. Same idempotency shape
      // `renderRouteRiskChoice` intends but expressed at the callsite
      // because that primitive is imported (not editable from here) and
      // doesn't cache its own signature. The gate makes the `<button>`
      // DOM nodes stable across ticks — the click's actionability check
      // now converges on the first stability window instead of chasing
      // a moving reference.
      // PR #1422 — include the mloop memory gate in the signature so
      // a memory-posture flip that doesn't change the offer SET (e.g.
      // a hypothetical fresh → returning transition with the same
      // jobIds) still re-stamps `data-mloop-memory-gate` / `aria-label`
      // / composed `lastAction`. Today the selection axis and the
      // posture axis change together (safe-default → completed set on
      // the first delivery), so this is defense-in-depth against a
      // future authoring change that could decouple them.
      const mloopGateForSignature = getMloopAvailableAction(
        offers[0]?.id ?? "",
        mloopMemory,
      ).memoryGate;
      const nextSignature = offers
        .map((offer) => `${offer.id}:${offer.routeRisk}`)
        .concat(`gate:${mloopGateForSignature}`)
        .join("|");
      if (offeredJobs.dataset.offerSignature !== nextSignature) {
        offeredJobs.dataset.offerSignature = nextSignature;
        while (offeredJobs.firstChild) {
          offeredJobs.removeChild(offeredJobs.firstChild);
        }
        const label = document.createElement("span");
        label.className = "route-choice-label";
        label.textContent = "Offered jobs";
        offeredJobs.appendChild(label);
        for (const offer of offers) {
          // PR #1422 — per-jobId M-LOOP copy + memory-gated action.
          // `selectMloopJobCopy` currently mirrors the visible label
          // the selector already authors, so the shipped text stays
          // `label · risk` (job-offers-played.spec.ts asserts that
          // exact string). `getMloopAvailableAction` gates the ACTION
          // id + accessible label off the durable memory posture,
          // and the id rides on `lastAction` composed with the
          // underlying jobId — one axis, no drift between the label
          // the player saw and the fact the game records.
          const mloopCopy = selectMloopJobCopy(offer.id, mloopMemory);
          const mloopAction = getMloopAvailableAction(offer.id, mloopMemory);
          const button = document.createElement("button");
          button.setAttribute("type", "button");
          button.setAttribute("id", `job-offer-${offer.id}`);
          button.setAttribute("data-aftersign-tap-choice", `offer-${offer.id}`);
          button.setAttribute("data-offered-job-id", offer.id);
          button.setAttribute("data-offered-job-risk", offer.routeRisk);
          button.setAttribute("data-mloop-job-id", mloopCopy.id);
          button.setAttribute("data-mloop-memory-gate", mloopAction.memoryGate);
          button.setAttribute("aria-label", mloopAction.label);
          stampJobOfferData(button, offer.id);
          button.textContent = `${offer.label} · ${offer.routeRisk} risk`;
          armJobOfferFeel(button, () => {
            // Compose the M-LOOP action id with the underlying
            // offered jobId so BOTH axes ride on `lastAction`. Old
            // shape (`job-offer:${offer.id}`) is superseded — a
            // downstream consumer that split on `:` still gets the
            // jobId as the tail token, and now also gets the mloop
            // action id (memory-gated) as the head.
            state.interaction.lastAction = `${mloopAction.id}:${offer.id}`;
            state.interaction.confirmCount += 1;
            markStateDirty();
            publishState();
          });
          offeredJobs.appendChild(button);
        }
      }
    } else if (offeredJobs.firstChild) {
      while (offeredJobs.firstChild) {
        offeredJobs.removeChild(offeredJobs.firstChild);
      }
      delete offeredJobs.dataset.offerSignature;
    }
  }

  if (isPacketChoiceBeat) {
    setTextContentIfChanged(acknowledgeRouteButton, "Acknowledge route");
    setTextContentIfChanged(skipRouteButton, "Skip acknowledgment");
    setTextContentIfChanged(deliverButton, "Deliver packet");
    stampAftersignChoice(acknowledgeRouteButton, "acknowledge-kiosk");
    stampAftersignChoice(skipRouteButton, "skip-kiosk-acknowledge");
    stampAftersignChoice(deliverButton, "deliver-packet");
  } else if (isReturnRecognitionBeat) {
    setTextContentIfChanged(acknowledgeRouteButton, "Kind return");
    setTextContentIfChanged(skipRouteButton, "Evasive return");
    setTextContentIfChanged(deliverButton, "Blunt return");
    stampAftersignChoice(acknowledgeRouteButton, "choose-return-tone");
    stampAftersignChoice(skipRouteButton, "choose-return-tone");
    stampAftersignChoice(deliverButton, "choose-return-tone");
    // PR #1236 M-CONTINUE-E1: the three tone buttons share the
    // `choose-return-tone` choice id (so pre-existing tap specs that
    // read that stamp still work), but each carries a distinct
    // `data-return-reason` axis-token — the same token used by
    // `returnToneChoiceFeel.ts` and `story/ioContinueBeats.ts`. The
    // click handlers below read this attribute off the tapped
    // button and store it on `state.player.returnReason` so
    // `lineForBeat()` can look up Io's REPLY + HANDOFF from
    // `buildIoContinueBeats(reason)`.
    acknowledgeRouteButton.dataset.returnReason =
      IO_RETURN_TONE_OPTIONS[0].id; // "kind"
    skipRouteButton.dataset.returnReason =
      IO_RETURN_TONE_OPTIONS[1].id; // "evasive"
    deliverButton.dataset.returnReason =
      IO_RETURN_TONE_OPTIONS[2].id; // "blunt"
  } else if (isReturnToneChoiceBeat) {
    setTextContentIfChanged(deliverButton, "Ask for next job");
    stampAftersignChoice(deliverButton, "ask-for-next-job");
    acknowledgeRouteButton.disabled = true;
    skipRouteButton.disabled = true;
    // PR #1236: recognition-beat stamps get cleared so a later tap on
    // deliverButton (now labeled "Ask for next job") can't overwrite
    // the reason the player just committed via a recognition tap.
    delete acknowledgeRouteButton.dataset.returnReason;
    delete skipRouteButton.dataset.returnReason;
    delete deliverButton.dataset.returnReason;
  } else if (isNextJobBeat) {
    const secondPacketCopy = selectIoSecondPacketCopyForReturnReason({
      returnReason: state.player.returnReason,
      playerName: state.player.name,
    });
    setTextContentIfChanged(acknowledgeRouteButton, secondPacketCopy.choices[0].label);
    setTextContentIfChanged(skipRouteButton, secondPacketCopy.choices[1].label);
    setTextContentIfChanged(deliverButton, "Deliver next packet");
    stampAftersignChoice(acknowledgeRouteButton, secondPacketCopy.choices[0].id);
    stampAftersignChoice(skipRouteButton, secondPacketCopy.choices[1].id);
    stampAftersignChoice(deliverButton, "deliver-packet");
    // PR #1236: same cleanup as above — no recognition-beat stamps
    // should leak into a beat where the buttons carry different
    // choice ids.
    delete acknowledgeRouteButton.dataset.returnReason;
    delete skipRouteButton.dataset.returnReason;
    delete deliverButton.dataset.returnReason;
    acknowledgeRouteButton.disabled = false;
    skipRouteButton.disabled = false;
  } else {
    setTextContentIfChanged(deliverButton, "Deliver packet");
    stampAftersignChoice(deliverButton, "deliver-packet");
    acknowledgeRouteButton.disabled = true;
    skipRouteButton.disabled = true;
  }

  const routeMemory = state.player.secondAction === SECOND_ACTION.DONE
    ? "listened"
    : state.player.secondAction === SECOND_ACTION.SKIPPED
      ? "ran early"
      : "unset";
  const packetStatus = state.packet.delivered
    ? `delivered ${state.delivery.outcome}`
    : state.packet.sealed
      ? "sealed"
      : "opened";
  // #1169 review: `memory: pending` was seeded in static HTML but this
  // format string overwrote it on first render, so the player never saw
  // Io's durable-memory status. Surface it from the fact ledger — pending
  // until deliverPacket mints facts, then flips to `recorded`.
  const memoryStatus = state.npcs.io.memory.length > 0 ? "recorded" : "pending";
  setTextContentIfChanged(stateReadout, `story: ${state.scene.beat} · packet ${packetStatus} · route ${routeMemory} · memory: ${memoryStatus} · player ${state.player.x.toFixed(1)},${state.player.z.toFixed(1)}`);
};

const setBeat = (beat) => {
  const canonicalBeat = canonicalFlagshipBeat(beat);
  if (state.scene.beat !== canonicalBeat) {
    state.scene.beat = canonicalBeat;
    if (canonicalBeat !== "io-next-job") {
      ioSecondPacketResponseLine = null;
    }
    markStateDirty();
  }
  const nextNpcId = canonicalBeat === "io-return-recognition" ? "io" : null;
  if (state.story.currentNpcId !== nextNpcId) {
    state.story.currentNpcId = nextNpcId;
    markStateDirty();
  }
  renderText();
  publishState();
};

const commitPacketOutcome = (outcome) => {
  if (outcome === PACKET_OUTCOME.SEALED) {
    if (!state.packet.sealed) {
      state.packet.sealed = true;
      markStateDirty();
    }
    setBeat("packet-choice");
  }

  if (outcome === PACKET_OUTCOME.OPENED) {
    if (state.packet.sealed) {
      state.packet.sealed = false;
      markStateDirty();
    }
    setBeat("packet-choice");
  }
};

// Failure sting fires on the TRANSITION into CANCELLED, never on the
// stale snapshot. Drift → cancel happens inside move(); the following
// pointerup → release() early-returns because controller.active=false
// and its snapshot still carries outcome=CANCELLED. Without this
// transition guard the sting double-fires and the player sees the
// 180ms flash replay. Reset on press() so a fresh interaction can
// fail cleanly.
let lastPacketOutcomeForFailure = PACKET_OUTCOME.UNKNOWN;

const maybeTriggerFailureFromOutcome = (outcome, source) => {
  if (outcome === PACKET_OUTCOME.CANCELLED
    && lastPacketOutcomeForFailure !== PACKET_OUTCOME.CANCELLED) {
    triggerFailureFeedback(source);
  }
  lastPacketOutcomeForFailure = outcome;
};

// Gesture-log for the sample-stream evaluator. The live controller
// reads press/move/release AS THEY HAPPEN and answers frame-by-frame;
// this log is the same gesture recorded verbatim so evaluatePacketIntent
// can hand back a summarised open/preserve/cancel verdict on release
// (with elapsedMs / dragPx / reason). Kept module-scoped so it doesn't
// pollute the harness-observed state until release commits it.
let packetGestureLog = [];

const resetPacketGestureLog = () => {
  packetGestureLog = [];
  if (state.interaction.packetIntentEvaluation !== null) {
    state.interaction.packetIntentEvaluation = null;
    markStateDirty();
  }
};

const recordPacketGestureSample = (action, input) => {
  packetGestureLog.push({
    action,
    timeMs: input.timeMs,
    x: input.x,
    y: input.y,
  });
};

const publishPacketIntentEvaluation = () => {
  const evaluation = evaluatePacketIntent(
    packetGestureLog,
    DEFAULT_EVALUATE_PACKET_INTENT_THRESHOLDS,
  );
  // Structural equality check so identical repeat gestures don't
  // spam markStateDirty on the hot path.
  const currentSerialized = JSON.stringify(state.interaction.packetIntentEvaluation);
  const nextSerialized = JSON.stringify(evaluation);
  if (currentSerialized !== nextSerialized) {
    state.interaction.packetIntentEvaluation = { ...evaluation };
    markStateDirty();
  }
};

const packetPress = (input) => {
  // Fresh gesture — drop the previous log so the evaluator sees only
  // this attempt (mirrors PacketIntentController.press's reset of
  // its own internal fields).
  resetPacketGestureLog();
  recordPacketGestureSample("press", input);
  const snapshot = packetIntent.press(input);
  lastPacketOutcomeForFailure = snapshot.outcome;
  syncPacketIntent(snapshot);
  publishState();
  return state.interaction.packetIntent;
};

const isCommittedOutcome = (outcome) =>
  outcome !== null && outcome !== undefined && outcome !== PACKET_OUTCOME.UNKNOWN;

const packetMove = (input) => {
  recordPacketGestureSample("drag", input);
  const snapshot = packetIntent.move(input);
  syncPacketIntent(snapshot);
  maybeTriggerFailureFromOutcome(snapshot.outcome, "packet-cancelled");
  if (isCommittedOutcome(snapshot.outcome)) commitPacketOutcome(snapshot.outcome);
  publishState();
  return state.interaction.packetIntent;
};

const packetTick = (timeMs) => {
  // Background-open guard: when the tab is hidden the rAF loop pauses,
  // then fires a single catch-up tick on resume. Without hasFocus that
  // tick advances the hold monotonically past HOLD_TO_OPEN_MS and
  // commits OPENED from a gesture the player never actually held —
  // #714's reported bug. Passing hasFocus:false makes the controller
  // freeze progress (openProgressAt) without advancing the hold clock.
  const snapshot = packetIntent.tick(timeMs, { hasFocus: !document.hidden });
  syncPacketIntent(snapshot);
  if (isCommittedOutcome(snapshot.outcome)) commitPacketOutcome(snapshot.outcome);
  publishState();
  return state.interaction.packetIntent;
};

const packetRelease = (input) => {
  recordPacketGestureSample("release", input);
  const snapshot = packetIntent.release(input);
  // Sample-stream evaluator runs AFTER the controller has committed the
  // frame-by-frame outcome. The controller still owns the live 450/14
  // e2e-pinned feel; this publishes the pure evaluator's summary verdict
  // (open/preserve/cancel + elapsedMs + dragPx + reason) on
  // `state.interaction.packetIntentEvaluation` so the harness can see
  // what the sibling helper said about the same gesture.
  publishPacketIntentEvaluation();
  syncPacketIntent(snapshot);
  maybeTriggerFailureFromOutcome(snapshot.outcome, "packet-cancelled");
  if (isCommittedOutcome(snapshot.outcome)) commitPacketOutcome(snapshot.outcome);
  publishState();
  return state.interaction.packetIntent;
};

const choose = async (choiceId) => {
  if (choiceId === "open-packet") {
    if (state.packet.sealed) {
      state.packet.sealed = false;
      markStateDirty();
    }
    setBeat("packet-choice");
    return;
  }

  if (choiceId === "keep-packet-sealed" || choiceId === "keep-sealed") {
    if (!state.packet.sealed) {
      state.packet.sealed = true;
      markStateDirty();
    }
    setBeat("packet-choice");
    return;
  }

  if (choiceId === "deliver-packet") {
    if (state.scene.beat === "io-next-job") {
      ioSecondPacketResponseLine = null;
      state.packet = {
        delivered: false,
        route: null,
        sealed: true,
        deliveredAt: null,
      };
      state.delivery.outcome = "unknown";
      state.player.secondAction = null;
      // #1395: the next-packet loop is a NEW packet-tap gesture, not a
      // route-choice re-run. `ask-for-next-job` → `io-next-job` →
      // `deliver-packet` here must re-enter at `packet-offered` (the
      // fresh packet-tap beat), NOT `packet-choice` (the post-tap
      // route-memory fork). Routing back into `packet-choice` skipped
      // the packet-tap surface — which is where the completed-set
      // job-offer UI has to land for a returning player. See
      // #1393 / #1395 for the full trace.
      setBeat("packet-offered");
      markStateDirty();
      publishState();
      return;
    }
    deliverPacket("contract-input");
    return;
  }

  if (choiceId === "return-to-io") {
    await advance();
    return;
  }

  if (choiceId === "acknowledge-kiosk" || choiceId === "skip-kiosk-acknowledge") {
    // #736 M2-E1: the SECOND deliberate kiosk action. Only valid at
    // the packet-choice beat — before deliver-packet mints the
    // route-attention fact. Recording it later would arrive AFTER
    // the fact is stamped and would lie about the fact's object.
    // The beat stays "packet-choice"; this is a durable player-input
    // flag, not a beat transition.
    if (state.scene.beat !== "packet-choice") {
      return;
    }
    const next = choiceId === "acknowledge-kiosk"
      ? SECOND_ACTION.DONE
      : SECOND_ACTION.SKIPPED;
    if (state.player.secondAction !== next) {
      state.player.secondAction = next;
      markStateDirty();
      publishState();
    }
    return;
  }

  const orraAction = actionForOrraChoice(choiceId);
  if (orraAction) {
    const nextRevision = state.save.revision + 1;
    const nextFact = buildOrraRecognitionMemoryFact({
      playerId: state.player.id,
      action: orraAction,
      sessionId,
      revision: nextRevision,
    });
    state.save.revision = nextRevision;
    state.npcs.orra.memory = [nextFact];
    // Keep Orra's spoken surface in lockstep with her memory at the
    // mint site — and route the chosen action through the canonical
    // action→line map so `light-vigil`/`spare-vigil` can never bypass
    // `ORRA_RETURN_LINE_BY_ACTION[action]`.
    state.npcs.orra.lastLineId = ORRA_RETURN_LINE_BY_ACTION[orraAction];
    state.npcs.orra.lastLine = lineCopyForOrraLineId(state.npcs.orra.lastLineId);
    // #1173 done-gate: cite the return-line id as the served refs so the
    // aftersign/e2e/orra-served-recognition.spec.ts can prove Orra
    // recognized the vigil action by REFERENCE (not by English text).
    state.npcs.orra.lastLineMemoryRefs = [state.npcs.orra.lastLineId];
    markStateDirty();
    await forceSave();
    publishState();
    return;
  }

  if (choiceId === "choose-return-tone") {
    // M-CONTINUE-E1: advance from `io-return-recognition` into the
    // return-tone fork. Only valid once Io has recognized the
    // returning player — otherwise the tone beat has nothing to
    // hang off. Silent no-op off-beat (mirrors acknowledge-kiosk).
    if (state.scene.beat !== "io-return-recognition") {
      return;
    }
    setBeat("return-tone-choice");
    // #1234: the tone the player just struck is marked "for later
    // episode use" in the script — persist it durably NOW, not at the
    // next incidental save. Without this, the last write was
    // deliverPacket()'s persist() at packet-delivered, so a reload
    // after choosing silently lost both the fork beat and
    // player.returnReason. forceSave writes local + authoritative
    // copies (same posture as the Orra mint branch above).
    await forceSave();
    publishState();
    return;
  }

  if (choiceId === "ask-for-next-job") {
    // M-CONTINUE-E1: advance from `return-tone-choice` into the
    // next-job beat authored in `packages/aftersign/next-job-beat.js`.
    // The trigger literal on the beat module (`after-return-tone-choice`)
    // is the contract this branch honors — same posture, same gate.
    if (state.scene.beat !== "return-tone-choice") {
      return;
    }
    setBeat("io-next-job");
    await forceSave();
    publishState();
    return;
  }

  if (choiceId === "accept-second-packet" || choiceId === "ask-what-changed") {
    if (state.scene.beat !== "io-next-job") {
      return;
    }
    const secondPacketCopy = selectIoSecondPacketCopyForReturnReason({
      returnReason: state.player.returnReason,
      playerName: state.player.name,
    });
    const selectedChoice = secondPacketCopy.choices.find((choice) => choice.id === choiceId);
    if (selectedChoice) {
      ioSecondPacketResponseLine = selectedChoice.response;
      state.npcs.io.lastLine = selectedChoice.response;
      state.npcs.io.lastLineMemoryRefs = [];
      markStateDirty();
      renderText();
      publishState();
    }
    return;
  }

  if (choiceId === "return-to-orra") {
    const selected = selectOrraRecognitionLine(state.npcs.orra.memory);
    state.npcs.orra.lastLineId = selected.lineId;
    state.npcs.orra.lastLine = lineCopyForOrraLineId(selected.lineId);
    state.npcs.orra.lastLineMemoryRefs = selected.lineId === ORRA_FIRST_CONTACT_LINE_ID
      ? []
      : [selected.lineId];
    markStateDirty();
    publishState();
    return;
  }

  throw new Error(`Unknown AFTERSIGN choice: ${choiceId}`);
};

const advance = async () => {
  if (state.packet.delivered && state.npcs.io.memory.length > 0) {
    markStateDirty();
    // #1113: the RETURN recognition beat carries the full feel envelope
    // (glow/DOM feedback/impact burst) — a returning session must FEEL
    // the recognition, not just read the line. deliverPacket() stamps
    // this clock for the live delivery beat; the reload→return path
    // reached the beat with the clock still null, so every envelope
    // consumer (recognitionEnvelopeAt, syncRecognitionDomFeedback,
    // impact-burst particles) computed as inactive and the e2e waits
    // stalled. Same lifecycle as deliverPacket: stamp, reset burst
    // bookkeeping, null the clock when the beat's window closes.
    // #1128: arm the recognition clock in the tick loop (not here),
    // so cold-CI rAF starvation cannot skip the burst window. See the
    // pendingRecognitionArm declaration for the full rationale.
    pendingRecognitionArm = true;
    state.interaction.recognitionBeatReport = null;
    lastImpactBurstChirpAt = null;
    impactBurstParticles = [];
    setTimeout(() => {
      publishRecognitionBeatReport(MEMORY_RECOGNITION_FEEDBACK.durationMs);
      memoryRecognitionBeatStartedAt = null;
      pendingRecognitionArm = false;
      lastImpactBurstChirpAt = null;
      impactBurstParticles = [];
      markStateDirty();
    }, MEMORY_RECOGNITION_FEEDBACK.durationMs);
    setBeat("io-return-recognition");
  }
};

const waitForStoryIdle = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  publishState();
};

const forceSave = async () => {
  persist({ dirty: false });

  if (breakMode === "local-only-save") {
    state.save.authority = "local-fallback";
    state.save.lastLoadProof = {
      source: "local-fallback",
      revision: state.save.revision,
      playerId: state.player.id,
    };
    markStateDirty();
    renderText();
    publishState();
    return;
  }

  await persistAuthoritative({ dirty: false });
  state.save.lastLoadProof = {
    source: "server",
    revision: state.save.revision,
    playerId: state.player.id,
  };
  markStateDirty();
  renderText();
  publishState();
};

const reloadFromSave = async ({ clearLocalState = false } = {}) => {
  const playerId = state.player.id;

  if (clearLocalState) {
    window.localStorage.removeItem(storageKey);
  }

  const authoritativeSave = breakMode === "local-only-save"
    ? null
    : await readAuthoritativeSave({
        slot,
        playerId,
      }).catch(() => null);
  const saved = authoritativeSave || (clearLocalState ? null : readStored());

  if (!saved) {
    // Two shapes reach this branch:
    //   (a) cold-boot no-op: caller invoked forceReload() with no
    //       args and there is nothing saved anywhere. The in-memory
    //       state is already at boot defaults — do nothing, so we
    //       stay byte-identical to the pre-#653 behavior and the
    //       many specs that call forceReload() before any save
    //       (io-phone-ready, io-recognition-*, memory-reference-
    //       integrity, npc-memory-line-contract...) keep passing.
    //   (b) explicit durability-wipe / local-only-save red probe:
    //       caller passed { clearLocalState: true } OR the runtime
    //       is in local-only-save break mode. HERE the caller is
    //       asserting "the durable path should have recovered
    //       something and did not" — we hard-reset the story/save
    //       surface so the failing assertions in the harness are
    //       genuine failures against a zeroed state, not stale
    //       in-memory state left over from before the wipe.
    if (!clearLocalState && breakMode !== "local-only-save") {
      return;
    }
    state.story.currentNpcId = null;
    state.story.memoryBeat = null;
    state.scene.beat = "packet-offered";
    // #736: clear the second-action flag too — otherwise a hard
  // reset could inherit the prior slice's kiosk acknowledgement
  // and mint a route-attention fact the new player never chose.
  state.player.secondAction = null;
  // Match resetSliceSave() shape (line ~1205) so the hard-reset
    // branch is consistent: `sealed: true` is the boot default and
    // `delivery.outcome: "unknown"` is what an unstarted slice
    // reports. The prior draft preserved packet.sealed via spread
    // while resetting delivery.outcome — Ivy flagged that as an
    // inconsistency on #675.
    state.packet = {
      delivered: false,
      route: null,
      sealed: true,
      deliveredAt: null,
    };
    state.delivery = { id: "blue-packet", outcome: "unknown" };
    state.npcs.io.memory = [];
    state.save = {
      ...emptySave(),
      authority: authoritativeSave ? "server" : "local-fallback",
      lastLoadProof: {
        source: null,
        revision: null,
        playerId,
      },
    };
    // Hard reset: no delivered save survives, so no returning-session
    // override may survive either.
    armReturningSessionBootLine(false);
    markStateDirty();
    renderText();
    publishState();
    return;
  }

  state.player = {
    ...state.player,
    ...saved.player,
    flags: {
      ...state.player.flags,
      ...(saved.player?.flags ?? {}),
    },
  };
  state.packet = { ...state.packet, ...saved.packet };
  state.delivery = {
    id: "blue-packet",
    outcome: saved.delivery?.outcome || (state.packet.delivered ? (state.packet.sealed ? "sealed" : "opened") : "unknown"),
  };
  // Red-guard hook (#653): drop-memory deliberately loses Io's
  // persisted memory on reload so the harness can prove it would
  // catch a dropped-memory regression. No-op when breakMode is "".
  state.npcs.io.memory = breakMode === "drop-memory"
    ? []
    : saved.memory ? clone(saved.memory) : [];
  // Red-guard hook (M-ORRA done-gate): deliberately drop Orra memory
  // on restore so the harness can prove recognition-loss goes red.
  state.npcs.orra.memory = breakMode === "orra-dropped"
    ? []
    : coerceOrraRecognitionMemory(saved.npcs?.orra?.memory);
  // publishState no longer re-derives Orra's spoken surface per
  // frame (see the comment above `syncIoLine` in publishState) —
  // stamp lastLineId/lastLine at every load site so the surface
  // is consistent by construction, not by frame-loop drift.
  const orraLineFromSaved = selectOrraRecognitionLine(state.npcs.orra.memory);
  state.npcs.orra.lastLineId = orraLineFromSaved.lineId;
  state.npcs.orra.lastLine = lineCopyForOrraLineId(orraLineFromSaved.lineId);
  state.npcs.orra.lastLineMemoryRefs = orraLineFromSaved.lineId === ORRA_FIRST_CONTACT_LINE_ID
    ? []
    : [orraLineFromSaved.lineId];
  state.save = { ...emptySave(), ...saved.save, dirty: false };
  state.save.authority = authoritativeSave ? "server" : "local-fallback";
  state.save.lastLoadProof = {
    source: authoritativeSave ? "server" : "local-fallback",
    revision: state.save.revision,
    playerId: state.player.id,
  };
  // A delivered save is a returning player's next offer, not a terminal
  // delivery screen. Preserve the completed memory while restoring the
  // offer beat so its divergent completed-set actions can render.
  state.scene.beat = typeof saved.beat === "string"
    ? canonicalFlagshipBeat(saved.beat)
    : "packet-offered";

  // PR #1249 (Soren review) — READ the io-next-job durability stamp
  // written by `buildIoNextJobDurabilityStamp` at save time. This is
  // what makes `save.ioNextJob` load-bearing rather than a write-only
  // ornament: if the stamp says the player parked at `io-next-job`
  // for this same durable playerId, the restored beat snaps to
  // `io-next-job` (superseding the canonicalFlagshipBeat fallback
  // for legacy payloads whose `saved.beat` was migrated away from
  // the current id), and `returnReason` is re-hydrated from the
  // stamp when the restored `state.player.returnReason` is missing
  // (older payloads, or a partial write). Guarded by playerId
  // equality so a stamp from a different slot / migrated identity
  // can never leak into this restore.
  const ioNextJobStamp = saved.save && typeof saved.save === "object"
    ? saved.save.ioNextJob
    : null;
  if (
    ioNextJobStamp
    && ioNextJobStamp.parked === true
    && ioNextJobStamp.beat === "io-next-job"
    && ioNextJobStamp.playerId === state.player.id
  ) {
    state.scene.beat = "io-next-job";
    if (
      !state.player.returnReason
      && typeof ioNextJobStamp.returnReason === "string"
      && IO_RETURN_TONE_OPTIONS.some((o) => o.id === ioNextJobStamp.returnReason)
    ) {
      state.player.returnReason = ioNextJobStamp.returnReason;
    }
  }

  // In-page reload of a delivered save must recognize the returning
  // player exactly like a real page reload does — re-arm the #957
  // boot override from the restored memory + beat.
  armReturningSessionBootLine(Boolean(state.packet.delivered));

  // Mara's re-review on PR #1139: `forceReload({ clearLocalState: true })`
  // was leaving a STALE `recognitionDomFeedback` snapshot on
  // `window.__game.interaction.recognitionDomFeedback` — the last frame
  // of the just-finished beat wrote `{ active:false, signGlowPx:8, … }`
  // (base-8 leak, recognition-dom-feedback.js:70 writes
  // `8 + kioskSign*18 + lantern*10` for every active instant, so `8`
  // survives when the two cues drop to zero). The
  // syncRecognitionDomFeedback inert-baseline guard (above) DOES clear
  // it on the next RAF tick, but flagship-surface-contract.spec.ts:729-750
  // waits only for `active === false` — already true stalely — and then
  // reads `signGlowPx` BEFORE the next frame runs the guard.
  //
  // Symmetry fix: reloadFromSave must synchronously zero the same
  // module-level `recognitionDomFeedback` + DOM cues + beat clock that
  // `resetSliceSave` zeroes (main.js:~1960). One reset shape, both
  // reset paths — the harness sees an inert snapshot in the SAME tick
  // the reload returns, no RAF race.
  memoryRecognitionBeatStartedAt = null;
  pendingRecognitionArm = false;
  lastImpactBurstChirpAt = null;
  impactBurstParticles = [];
  framesDuringRecognitionBeat = 0;
  recognitionDomFeedback = {
    active: false,
    signGlowPx: 0,
    sealGlowPx: 0,
    rainRimAlpha: 0,
    hapticScale: 1,
    warmth: 0,
  };
  clearRecognitionDomFeedback({
    lineNode: line,
    speakerNode: speaker,
    stateReadoutNode: stateReadout,
  });
  // `state.interaction.recognitionFeedback` is deliberately LEFT ALONE
  // here. It is amplitude CONFIG (what the NEXT beat will do), not beat
  // activity — the beat clock above going null is what says "no beat is
  // running". Reload must PRESERVE it, because the specs pin all three
  // corners of the truth table:
  //   • zero it on reload (previous iteration) → the returning-session
  //     beat plays with a dead camera: io-recognition-return-visual-feel
  //     + io-recognition-memory-beat-contract's range check measure only
  //     the confirm-kick wobble (~0.12m) against a 0.24m contract floor
  //     — the exact 2-failure CI red on this PR's last run.
  //   • re-arm it to the authored MEMORY_RECOGNITION_FEEDBACK → the
  //     measured-vs-canned gate (io-recognition-memory-beat-contract
  //     :138-171) breaks: it zeroes via setRecognitionCameraEnvelope,
  //     and collectBeat() forceReloads BEFORE driving the flat beat, so
  //     restoring authored amplitudes un-zeroes its override.
  //   • preserve (this code, = main's semantics) → boot value 0.32 rides
  //     through normal reloads, the harness's explicit zero rides
  //     through the gate's reload. Every spec satisfied.
  // Post-beat analytic report doesn't survive a reload — it described
  // the previous session's beat, not this one.
  state.interaction.recognitionBeatReport = null;
  state.interaction.recognitionSnippetFeelCue = null;
  // Zero the `--io-recognition-*` CSS custom properties so the shipped
  // surface's DOM envelope (body::after vignette, .panel translateZ+yaw,
  // .line reveal timing) drops back to its inert baseline in the same
  // synchronous tick.
  applyIoRecognitionFeelCueVars(null);

  markStateDirty();
  renderText();
  publishState();
};

const makeRainBuffer = (context) => {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.38;
  }
  return buffer;
};

const startAmbientAudio = () => {
  if (!audioContext || state._runtime.audio.ambientStarted) {
    return;
  }

  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0.045;
  ambientGain.connect(audioContext.destination);

  rainNoise = audioContext.createBufferSource();
  rainNoise.buffer = makeRainBuffer(audioContext);
  rainNoise.loop = true;

  rainFilter = audioContext.createBiquadFilter();
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = 1350;
  rainFilter.Q.value = 0.72;
  rainNoise.connect(rainFilter).connect(ambientGain);
  rainNoise.start();

  kioskHum = audioContext.createOscillator();
  kioskHum.type = "sine";
  kioskHum.frequency.value = 91;
  kioskHumGain = audioContext.createGain();
  kioskHumGain.gain.value = 0.018;
  kioskHum.connect(kioskHumGain).connect(ambientGain);
  kioskHum.start();

  state._runtime.audio.ambientStarted = true;
  markStateDirty();
};

const enableAudio = async () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    state._runtime.audio.lastCue = "unsupported";
    markStateDirty();
    publishState();
    return false;
  }

  audioContext ||= new AudioContext();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  state._runtime.audio.unlocked = audioContext.state === "running";
  if (state._runtime.audio.unlocked && !state._runtime.audio.ambientStarted) {
    startAmbientAudio();
    state._runtime.audio.lastCue = "ambient-rainline";
    state._runtime.audio.lastCueAt = performance.now();
  }
  markStateDirty();
  publishState();
  return state._runtime.audio.unlocked;
};

const playKioskConfirm = async () => {
  // Stamp the STORY-LEVEL cue FIRST, before the audio-unlock gate.
  // The look/sound contract is "the game dispatched a packet-confirmed
  // cue on the same tick as the visual feedback" — that dispatch is
  // deterministic and independent of whether the browser actually
  // unlocked its AudioContext (headless CI without a user gesture
  // leaves audioContext.state === "suspended" and enableAudio()
  // returns false; if we gate lastCue on that we can never assert
  // the coupling from an e2e harness). The actual oscillator tones
  // are still gated on unlock — that's a real-audio concern — but
  // the state marker is set unconditionally so the harness (and any
  // downstream analytics consumer) can observe that the cue fired.
  const stampConfirmCue = () => {
    state._runtime.audio.lastCue = "packet-confirmed";
    state._runtime.audio.lastCueAt = performance.now();
    markStateDirty();
    publishState();
  };
  stampConfirmCue();

  const unlocked = await enableAudio();
  // enableAudio() may overwrite lastCue with "ambient-rainline" on
  // its FIRST successful unlock. Re-stamp packet-confirmed after —
  // the CONFIRM cue is the more specific signal for this call.
  stampConfirmCue();
  if (!unlocked || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  gain.connect(audioContext.destination);

  const cue = CONFIRM_FEEDBACK.audioCue;
  const tone = audioContext.createOscillator();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(cue.frequencyHz, now);
  tone.connect(gain);
  tone.start(now);
  tone.stop(now + cue.durationMs / 1000);
};

const triggerRecognitionImpactChirp = async ({ frequencyHz, durationMs }) => {
  state._runtime.audio.lastCue = "recognition-impact-chirp";
  state._runtime.audio.lastCueAt = performance.now();
  markStateDirty();
  publishState();

  const unlocked = await enableAudio();
  if (!unlocked || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  impactBurstChirpGain ??= audioContext.createGain();
  impactBurstChirpGain.connect(audioContext.destination);
  impactBurstChirpGain.gain.cancelScheduledValues(now);
  impactBurstChirpGain.gain.setValueAtTime(0.0001, now);
  impactBurstChirpGain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
  impactBurstChirpGain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  const chirp = audioContext.createOscillator();
  chirp.type = "sine";
  chirp.frequency.setValueAtTime(frequencyHz, now);
  chirp.connect(impactBurstChirpGain);
  chirp.start(now);
  chirp.stop(now + durationMs / 1000);
};

const setConfirmCameraKick = ({ worldX = CONFIRM_FEEDBACK.cameraKickWorldX, yawDegrees = CONFIRM_FEEDBACK.cameraKickDeg } = {}) => {
  state.interaction.confirmFeedback.cameraKickWorldX = worldX;
  state.interaction.confirmFeedback.cameraKickDeg = yawDegrees;
  markStateDirty();
  publishState();
};

// Harness-only: override the recognition-beat camera envelope
// amplitudes. Zeroing both proves the durable memoryBeat reports
// MEASURED camera motion (the probe reads the live pose, which goes
// flat when the envelope is flat), not canned contract literals.
const setRecognitionCameraEnvelope = ({
  cameraDeltaMeters = MEMORY_RECOGNITION_FEEDBACK.cameraDeltaMeters,
  cameraYawDegrees = MEMORY_RECOGNITION_FEEDBACK.cameraYawDegrees,
} = {}) => {
  state.interaction.recognitionFeedback.cameraDeltaMeters = cameraDeltaMeters;
  state.interaction.recognitionFeedback.cameraYawDegrees = cameraYawDegrees;
  markStateDirty();
  publishState();
};

const triggerKioskFeedback = (source) => {
  state.interaction.lastAction = source;
  state.interaction.kioskPulse = 1;
  state.interaction.confirmCount += 1;
  state.interaction.confirmStartedAt = performance.now();
  state.interaction.confirmFeedback = {
    ...state.interaction.confirmFeedback,
    active: true,
    remainingMs: CONFIRM_FEEDBACK.durationMs,
    reticleScalePeak: CONFIRM_FEEDBACK.reticleScalePeak,
    reticleLiftPx: CONFIRM_FEEDBACK.reticleLiftPx,
    audioCue: { ...CONFIRM_FEEDBACK.audioCue },
  };
  markStateDirty();
  publishState();
};

const triggerFailureFeedback = (source) => {
  state.interaction.lastAction = source;
  state.interaction.failureStartedAt = performance.now();
  state.interaction.failureFeedback = {
    ...FAILURE_FEEDBACK,
    active: true,
    remainingMs: FAILURE_FEEDBACK.durationMs,
  };
  markStateDirty();
  publishState();
};

let memoryBeatCameraProbe = null;
let memoryRecognitionBeatStartedAt = null;
// Frames the render loop actually painted during the current beat — the
// live-evidence count published in the beat report (#1127/#1134).
let framesDuringRecognitionBeat = 0;

// Analytic recognition-beat report (#1127/#1134/#1128): even with the
// arm-on-first-tick fix, a starved SwiftShader can paint too few frames
// for anything sampling LIVE transient values (specs, telemetry) to
// observe the beat's cues — some cue windows are 54ms wide. At beat END
// we sample the PURE envelope/motion math at 8ms steps over the beat's
// timeline and publish the peaks: what the beat was AUTHORED to feel
// like, independent of frames painted. framesDuringBeat says how much
// live evidence also exists; consumers gate live-DOM assertions on it.
const buildRecognitionBeatReport = (durationMs) => {
  const report = {
    beatDurationMs: durationMs,
    framesDuringBeat: framesDuringRecognitionBeat,
    peakSignGlowPx: 0,
    peakSealGlowPx: 0,
    peakRainRimAlpha: 0,
    peakHapticScale: 1,
    peakWarmth: 0,
    peakImpactBurstParticles: 0,
    peakCameraDeltaMeters: 0,
    peakCameraYawDegrees: 0,
  };
  const outcome = state.packet.sealed ? "sealed" : "opened";
  for (let t = 0; t <= durationMs; t += 8) {
    // recognitionEnvelopeAt is pure over ELAPSED time — sample it
    // directly rather than through recognitionMotionAt, which depends on
    // memoryRecognitionBeatStartedAt and returns the empty stub when the
    // clock never armed (the exact zero-frame case this report exists
    // to survive).
    const envelope = recognitionEnvelopeAt(t);
    const fb = computeRecognitionDomFeedback({
      elapsedMs: t,
      outcome,
      envelope,
    });
    if (fb.signGlowPx > report.peakSignGlowPx) report.peakSignGlowPx = fb.signGlowPx;
    if (fb.sealGlowPx > report.peakSealGlowPx) report.peakSealGlowPx = fb.sealGlowPx;
    if (fb.rainRimAlpha > report.peakRainRimAlpha) report.peakRainRimAlpha = fb.rainRimAlpha;
    if (fb.hapticScale > report.peakHapticScale) report.peakHapticScale = fb.hapticScale;
    if (fb.warmth > report.peakWarmth) report.peakWarmth = fb.warmth;
    const n = envelope?.impactBurst?.particles?.length ?? 0;
    if (n > report.peakImpactBurstParticles) report.peakImpactBurstParticles = n;
    // Camera envelope peaks (absolute magnitude — the envelope emits
    // signed motion, but the assertions in
    // io-recognition-return-visual-feel.spec.ts:361-364 test the peak
    // amplitude reached during the beat against a positive band
    // [0.24, 0.36] m and [3, 5] deg). Without this fold both fields
    // stay 0 and the new spec reds, because the loop above only
    // records DOM-cue peaks (glow/rim/haptic/warmth/particles).
    const cameraDelta = Math.abs(envelope?.cameraDeltaMeters ?? 0);
    if (cameraDelta > report.peakCameraDeltaMeters) {
      report.peakCameraDeltaMeters = cameraDelta;
    }
    const cameraYaw = Math.abs(envelope?.cameraYawDegrees ?? 0);
    if (cameraYaw > report.peakCameraYawDegrees) {
      report.peakCameraYawDegrees = cameraYaw;
    }
  }
  return report;
};

const publishRecognitionBeatReport = (durationMs) => {
  state.interaction.recognitionBeatReport = buildRecognitionBeatReport(durationMs);
  markStateDirty();
};
// #1128 fix: on cold SwiftShader CI, deliverPacket() and advance() run
// synchronously from an input.choose() await — the FIRST rAF after that
// can be starved by >200ms while the WebGL surface warms. Stamping
// memoryRecognitionBeatStartedAt with performance.now() at that moment
// makes recognitionMotionAt() see an already-elapsed burst window
// (particleBurstStartFrame=4 → 67ms) on the very first tick that fires,
// so impactBurstAt returns particles.length=0 and syncImpactBurstDom
// never reconciles any nodes. Fix: defer the arm to the tick loop —
// mark pendingRecognitionArm=true here, and on the next tick, stamp
// memoryRecognitionBeatStartedAt = rAF's `now` (which is the render
// clock, not the wall clock). The burst then measures its window from
// the first frame that ACTUALLY paints, immune to cold-start rAF
// starvation. The setTimeout(1180) that closes the beat stays on wall
// clock; a starved-cold beat therefore runs its animation window
// against tick time and only truncates the tail — which is fine, the
// tail lands after inputLockMs anyway.
let pendingRecognitionArm = false;
let lastImpactBurstChirpAt = null;
let impactBurstParticles = [];
let impactBurstChirpGain = null;
let recognitionDomFeedback = {
  active: false,
  signGlowPx: 0,
  sealGlowPx: 0,
  rainRimAlpha: 0,
  hapticScale: 1,
  warmth: 0,
};

const easeOutCubic = (value) => 1 - ((1 - clamp(value, 0, 1)) ** 3);
const easeInOutCubic = (value) => {
  const k = clamp(value, 0, 1);
  return k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
};

const recognitionEnvelopeAt = (elapsedMs) =>
  recognitionFeedbackEnvelopeAt(
    elapsedMs,
    state.packet.sealed ? "sealed" : "opened",
    state.interaction.recognitionFeedback,
  );

// Compute the recognition envelope's contribution at an arbitrary
// timestamp — 0 when no recognition beat is running. Shared by the
// render tick and the analytical camera probe so the probe measures
// the SAME pose the loop paints (the earlier draft omitted this from
// computeCameraPoseAt, so the durable beat under-reported the dolly
// by ~6x versus what the camera actually did).
const recognitionMotionAt = (nowMs) => {
  if (memoryRecognitionBeatStartedAt === null) {
    // Must include EVERY key the render loop reads from this shape —
    // signLight.intensity (line ~1515) sums recognitionMotion.signGlowBoost
    // every frame, and `undefined + number` = NaN, which three.js silently
    // propagates into the point-light shader and blacks out the scene.
    // The aftersign e2e lane went red on exactly this before we added
    // signGlowBoost to the inactive-branch stub.
    return {
      cameraDeltaMeters: 0,
      cameraYawDegrees: 0,
      signGlowBoost: 0,
      impactBurst: {
        particles: [],
        chirp: {
          shouldTrigger: false,
          frequencyHz: 880,
          durationMs: 90,
        },
      },
    };
  }
  return recognitionEnvelopeAt(
    nowMs - memoryRecognitionBeatStartedAt,
    state.packet.sealed ? "sealed" : "opened",
    state.interaction.recognitionFeedback,
  );
};

const syncRecognitionDomFeedback = (nowMs) => {
  if (memoryRecognitionBeatStartedAt === null) {
    // Off-beat inert baseline: every recognitionDomFeedback field must
    // be zero (or `hapticScale: 1`, the neutral scale). The guard used
    // to trigger only on `active === true`, but
    // applyRecognitionDomFeedback (recognition-dom-feedback.js:70)
    // writes `signGlowPx = 8 + kioskSign * 18 + lantern * 10` — the
    // BASE 8 leaks through on late-beat frames where every cue's
    // intensity has already dropped to 0 but `normalized` is 0 or 1 (so
    // `active === false`). When the beat clock nulled, the `active`-only
    // cleanup was skipped and the stale `signGlowPx: 8` survived across
    // `forceReload({ clearLocalState: true })` — the flake Mara caught
    // on PR #1139 review (`resetFeedback.signGlowPx === 8` at
    // flagship-surface-contract.spec.ts :750). Check the inert
    // invariant directly: if any field is off-baseline, run the same
    // clear the `active`-only branch used to.
    const inert =
      !recognitionDomFeedback.active
      && recognitionDomFeedback.signGlowPx === 0
      && recognitionDomFeedback.sealGlowPx === 0
      && recognitionDomFeedback.rainRimAlpha === 0
      && recognitionDomFeedback.hapticScale === 1
      && recognitionDomFeedback.warmth === 0;
    if (!inert) {
      clearRecognitionDomFeedback({
        lineNode: line,
        speakerNode: speaker,
        stateReadoutNode: stateReadout,
      });
      recognitionDomFeedback = {
        active: false,
        signGlowPx: 0,
        sealGlowPx: 0,
        rainRimAlpha: 0,
        hapticScale: 1,
        warmth: 0,
      };
      markStateDirty();
    }
    return recognitionDomFeedback;
  }

  const elapsedMs = nowMs - memoryRecognitionBeatStartedAt;
  recognitionDomFeedback = applyRecognitionDomFeedback({
    lineNode: line,
    speakerNode: speaker,
    stateReadoutNode: stateReadout,
    elapsedMs,
    outcome: state.packet.sealed ? "sealed" : "opened",
    envelope: recognitionEnvelopeAt(elapsedMs),
  });
  markStateDirty();
  return recognitionDomFeedback;
};

// #1104: spawn one DOM primitive per particle emitted by the recognition
  // envelope's impact-burst. Reconciles children to `particles.length` each
  // frame — 14 nodes during the frame-4 burst window, 0 otherwise (and 0
  // under reduced-motion, since the envelope returns an empty array).
  // Anchored to `#recognitionImpactBurst`, positioned near the on-screen
  // NPC-eye anchor by index.html CSS (top:34vh, left:50%). Kept as DOM
  // (not canvas) so the io-recognition-return-visual-feel e2e can count
  // primitives directly with querySelectorAll.
  const syncImpactBurstDom = (particles) => {
    if (!impactBurstOverlay) return;
    const children = impactBurstOverlay.children;
    while (children.length < particles.length) {
      const node = document.createElement("div");
      node.className = "impact-burst-particle";
      impactBurstOverlay.appendChild(node);
    }
    while (children.length > particles.length) {
      impactBurstOverlay.removeChild(children[children.length - 1]);
    }
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const node = children[i];
      node.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
      node.style.opacity = String(p.alpha);
    }
  };

  // Analytical model of the camera pose the tick loop paints — same
// formula as the tick body below, extracted so we can sample the peak
// wobble at fixed millisecond intervals INSTEAD of relying on rAF
// firing during the 220ms confirm window. On cold CI (SwiftShader,
// slow first paint) the render loop can skip the confirm window
// entirely — a single tick at progress≈0 followed by one at
// progress≈0.9 misses every wobble peak, and the measured delta/yaw
// collapse to zero. Analytical sampling makes the probe deterministic
// while still reading LIVE state (cameraKickWorldX / cameraKickDeg /
// state.player.x/z) so an override like setConfirmCameraKick({0,0})
// still zeros the reported motion.
const { computeCameraPoseAt } = createCameraPoseSampler({
  state,
  CONFIRM_FEEDBACK,
  FAILURE_FEEDBACK,
  prefersReducedMotion,
  interactionConfirmEnvelopeAt,
  failureStingEnvelopeAt,
  recognitionMotionAt,
  computeKioskCameraTarget,
  DEFAULT_KIOSK_CAMERA_RIG,
  THREE,
});

const startMemoryBeatCameraProbe = (startedAt) => {
  // Anchor the probe to the DETERMINISTIC "resting" camera pose (the
  // pose the render loop would paint with confirmWobble=0 and
  // failureWobble=0), NOT to camera.position.clone(). If we captured
  // the live clone we'd race the render loop: on cold CI runs the
  // first tick after startProbe can be the one that installs
  // state.player.x/z into camera.position for the first time, so
  // delta from (0, 2.25, 7.6) picks up ~0.26m of baseline instead
  // of the ~0.05m confirm kick we're actually measuring. This
  // anchors on state so the delta is purely the wobble contribution.
  // Anchor uses the SAME resting-pose math as computeCameraPoseAt's
  // base — otherwise dx/dz would encode the (rig-baseline vs
  // player*0.12 legacy) offset instead of the pure wobble
  // contribution we're trying to measure.
  const anchorPose = computeKioskCameraTarget(
    {
      playerX: state.player.x,
      playerZ: state.player.z,
      facingRadians: state.player.facingRadians,
      velocityX: 0,
      velocityZ: 0,
    },
    DEFAULT_KIOSK_CAMERA_RIG,
  );
  memoryBeatCameraProbe = {
    startedAt,
    startX: anchorPose.x,
    startZ: anchorPose.z,
    maxDeltaMeters: 0,
    maxYawDegrees: 0,
  };
  // Analytical peak-catcher: sample at 10ms intervals across the
  // 220ms confirm window. The confirm-wobble peak lands near
  // progress≈0.083 (first sine crest under the (1-p)^3 falloff);
  // a 10ms cadence has ~22 samples across the window, so we always
  // land within ~5ms of that peak regardless of rAF jitter.
  if (memoryBeatCameraProbe.intervalId) {
    clearInterval(memoryBeatCameraProbe.intervalId);
  }
  memoryBeatCameraProbe.intervalId = setInterval(() => {
    sampleMemoryBeatCameraProbe();
  }, 10);
};

const sampleMemoryBeatCameraProbe = () => {
  if (!memoryBeatCameraProbe) {
    return;
  }
  // Prefer the analytical model — it reads live state and is
  // independent of whether the render loop has actually ticked
  // in the confirm window. camera.position/rotation is still
  // sampled (via tick's sampleMemoryBeatCameraProbe call) as a
  // fallback, but the analytical path guarantees peak coverage.
  const pose = computeCameraPoseAt(performance.now());
  const dx = pose.x - memoryBeatCameraProbe.startX;
  const dz = pose.z - memoryBeatCameraProbe.startZ;
  const deltaMeters = Math.hypot(dx, dz);
  const yawDegrees = Math.abs(THREE.MathUtils.radToDeg(pose.rotationZ));
  memoryBeatCameraProbe.maxDeltaMeters = Math.max(memoryBeatCameraProbe.maxDeltaMeters, deltaMeters);
  memoryBeatCameraProbe.maxYawDegrees = Math.max(memoryBeatCameraProbe.maxYawDegrees, yawDegrees);
};

const finishMemoryBeatCameraProbe = () => {
  sampleMemoryBeatCameraProbe();
  if (memoryBeatCameraProbe?.intervalId) {
    clearInterval(memoryBeatCameraProbe.intervalId);
  }
  const measured = memoryBeatCameraProbe
    ? {
        cameraDeltaMeters: Number(memoryBeatCameraProbe.maxDeltaMeters.toFixed(3)),
        cameraYawDegrees: Number(memoryBeatCameraProbe.maxYawDegrees.toFixed(2)),
      }
    : { cameraDeltaMeters: 0, cameraYawDegrees: 0 };
  memoryBeatCameraProbe = null;
  return measured;
};

const deliverPacket = (source = "hud-button") => {
  triggerKioskFeedback(source);
  state.packet.delivered = true;
  state.packet.route = "blue rainline";
  state.packet.deliveredAt = new Date().toISOString();
  state.delivery.outcome = state.packet.sealed ? "sealed" : "opened";
  const { packetOutcomeFact, secondActionFact } = memoryFacts();
  state.npcs.io.memory = [packetOutcomeFact, secondActionFact];
  state.save.revision += 1;
  state.save.dirty = true;
  const beatStartedAt = performance.now();
  startMemoryBeatCameraProbe(beatStartedAt);
  // #1128: defer recognition-clock arm to the tick loop — see the
  // pendingRecognitionArm declaration. Prevents cold-CI rAF starvation
  // from swallowing the impact-burst window (frames 4-20 @60fps).
  pendingRecognitionArm = true;
  state.interaction.recognitionBeatReport = null;
  lastImpactBurstChirpAt = null;
  playKioskConfirm();
  markStateDirty();
  setBeat("packet-delivered");
  setTimeout(() => {
    const beatEndedAt = performance.now();
    const durableOutcome = state.npcs.io.memory.find((fact) => fact.kind === "delivery-outcome")?.object === "opened" ? "opened" : "sealed";
    const secondAction = secondActionFromMemory(state.npcs.io.memory);
    const { packetOutcome: memory_ref, secondAction: secondAction_memory_ref } = memoryRefsFromMemory(state.npcs.io.memory);
    const cameraMotion = finishMemoryBeatCameraProbe();
    publishRecognitionBeatReport(MEMORY_RECOGNITION_FEEDBACK.durationMs);
    memoryRecognitionBeatStartedAt = null;
    pendingRecognitionArm = false;
    lastImpactBurstChirpAt = null;
    impactBurstParticles = [];
    state.story.memoryBeat = {
      kind: "io_packet_return",
      outcome: durableOutcome,
      secondAction,
      memory_ref,
      secondAction_memory_ref,
      save_revision: state.save.revision,
      startedAt: beatStartedAt,
      endedAt: beatEndedAt,
      cameraDeltaMeters: cameraMotion.cameraDeltaMeters,
      cameraYawDegrees: cameraMotion.cameraYawDegrees,
      inputLockMs: Math.min(MEMORY_RECOGNITION_FEEDBACK.durationMs, Math.max(0, Math.round(beatEndedAt - beatStartedAt))),
      lineId: durableOutcome === "sealed"
        ? "io_return_packet_sealed"
        : "io_return_packet_opened",
    };
    markStateDirty();
    setBeat("io-return-recognition");
  }, 1180);
  persist({ dirty: true });
};

const resetSliceSave = async () => {
  window.localStorage.removeItem(storageKey);
  await clearAuthoritativeSave({ slot, playerId: state.player.id });
  packetIntent.reset();
  resetPacketGestureLog();
  state.scene.beat = "packet-offered";
  ioSecondPacketResponseLine = null;
  state.story.currentNpcId = null;
  state.story.memoryBeat = null;
  state.player = {
    id: "local-slice-player",
    // Reset must reproduce the SHAPE of the cold-boot `state.player`
    // — every field the served-page contract exposes, or downstream
    // reads land on `undefined` and throw. Missing `flags` was the
    // load-bearing gap: `publishState()` exposes `state.player` live,
    // and both `lineForBeat()` and the tap-driven memory-dialogue e2e
    // (reset-surface-orientation-contract.spec.ts) read
    // `state.player.flags.io_intro_seen` at the recognition beat.
    // Without it the reset would leave the returning slice unable to
    // reach the memory-citing branch (Soren PR #1262 REQUEST_CHANGES).
    //
    // `io_intro_seen: true` is intentional here — resetSliceSave is
    // the "start a fresh RETURNING session" entry point, not a
    // first-boot mint. The e2e uses it to place the player past
    // first-meeting so it can drive the memory-citing dialogue on
    // the shipped page; a cold `false` would branch into the
    // first-meeting copy and red the walk-through.
    name: null,
    flags: {
      io_intro_seen: true,
    },
    x: -1.8,
    z: 1.15,
    // Match the cold-boot kiosk-facing pose. Boot uses π so the
    // player faces the kiosk at -z; reset must not silently rotate
    // the slice away from the served-page contract.
    facingRadians: Math.PI,
    // #736: reset the second-action flag alongside the packet
    // outcome so a fresh slice cannot silently inherit a prior
    // player's kiosk acknowledgement.
    secondAction: null,
    returnReason: null,
  };
  state.packet = { delivered: false, route: null, sealed: true, deliveredAt: null };
  state.delivery = { id: "blue-packet", outcome: "unknown" };
  state.npcs.io.memory = [];
  state.npcs.io.lastLineMemoryRefs = [];
  state.npcs.orra.memory = [];
  state.npcs.orra.lastLineId = ORRA_FIRST_CONTACT_LINE_ID;
  state.npcs.orra.lastLine = lineCopyForOrraLineId(ORRA_FIRST_CONTACT_LINE_ID);
  state.npcs.orra.lastLineMemoryRefs = [];
  state.save = emptySave();
  state.movement.input = { x: 0, z: 0, source: "none", active: false };
  state.movement.velocityX = 0;
  state.movement.velocityZ = 0;
  state.movement.lastStepMs = 0;
  state.movement.lastVelocityMetersPerSecond = 0;
  state.movement.fixedStepsLastFrame = 0;
  state.movement.droppedStepMs = 0;
  state.movement.mobilePad = mobileMovePadController
    ? mobileMovePadController.snapshot()
    : {
        active: false,
        input: { x: 0, z: 0, knobX: 0, knobY: 0, magnitude: 0 },
        feel: { ...MOBILE_MOVE_PAD },
      };
  movementAccumulator = 0;
  state.cameraRig = null;
  state.interaction.lastAction = null;
  state.interaction.lastPointer = null;
  state.interaction.kioskPulse = 0;
  state.interaction.confirmCount = 0;
  state.interaction.confirmStartedAt = null;
  state.interaction.failureStartedAt = null;
  state.interaction.confirmFeedback = {
    ...CONFIRM_FEEDBACK,
    active: false,
    remainingMs: 0,
  };
  state.interaction.recognitionFeedback = {
    ...MEMORY_RECOGNITION_FEEDBACK,
  };
  impactBurstParticles = [];
  lastImpactBurstChirpAt = null;
  state.interaction.failureFeedback = {
    ...FAILURE_FEEDBACK,
    active: false,
    remainingMs: 0,
  };
  memoryRecognitionBeatStartedAt = null;
  pendingRecognitionArm = false;
  recognitionDomFeedback = {
    active: false,
    signGlowPx: 0,
    sealGlowPx: 0,
    rainRimAlpha: 0,
    hapticScale: 1,
    warmth: 0,
  };
  clearRecognitionDomFeedback({
    lineNode: line,
    speakerNode: speaker,
    stateReadoutNode: stateReadout,
  });
  lastPacketOutcomeForFailure = PACKET_OUTCOME.UNKNOWN;
  markStateDirty();
  syncPacketIntent();
  document.documentElement.style.setProperty("--confirm-shake-x", "0px");
  document.documentElement.style.setProperty("--confirm-shake-y", "0px");
  document.documentElement.style.setProperty("--confirm-reticle-scale", "1");
  document.documentElement.style.setProperty("--confirm-reticle-y", "0px");
  if (failureSting) {
    failureSting.style.opacity = "0";
  }
  camera.position.x = 0;
  camera.rotation.z = 0;
  renderText();
  publishState();
};

// Harness-only: restore state from a snapshot produced by getSnapshot(),
// OR (no arg) fall back to resetSliceSave(). Restores the same fields
// getSnapshot() exposes — scene, player, packet, npcs, save — via a
// deep clone so the caller's snapshot is not aliased into live state.
// Runtime-only concerns (audio, transient interaction feedback) are
// intentionally left as-is; they aren't part of the story-state contract.
const reset = (snapshot) => {
  if (!snapshot || typeof snapshot !== "object") {
    resetSliceSave();
    return;
  }
  const restored = clone(snapshot);
  if (restored.scene && typeof restored.scene.beat === "string") {
    state.scene.beat = restored.scene.beat;
  }
  if (restored.story && typeof restored.story === "object") {
    state.story.currentNpcId = restored.story.currentNpcId ?? null;
    state.story.memoryBeat = restored.story.memoryBeat ?? null;
  }
  if (restored.player && typeof restored.player === "object") {
    state.player = { ...state.player, ...restored.player };
  }
  if (restored.packet && typeof restored.packet === "object") {
    state.packet = { ...state.packet, ...restored.packet };
  }
  if (restored.delivery && typeof restored.delivery === "object") {
    state.delivery = { id: "blue-packet", outcome: restored.delivery.outcome || "unknown" };
  }
  if (restored.npcs && restored.npcs.io) {
    state.npcs.io.memory = Array.isArray(restored.npcs.io.memory)
      ? clone(restored.npcs.io.memory)
      : [];
    state.npcs.io.lastLine = restored.npcs.io.lastLine ?? null;
    state.npcs.io.lastLineMemoryRefs = Array.isArray(restored.npcs.io.lastLineMemoryRefs)
      ? clone(restored.npcs.io.lastLineMemoryRefs)
      : [];
  }
  if (restored.npcs && restored.npcs.orra) {
    state.npcs.orra.memory = coerceOrraRecognitionMemory(restored.npcs.orra.memory);
    // Fall back to deriving lastLine/lastLineId from the restored
    // memory if the persisted payload predates them (or the payload
    // was hand-shaped by a test) — the memory is the source of truth
    // for which line Orra should speak, per the pure-logic contract.
    // publishState no longer re-derives per frame (see its comment),
    // so a fallback that lands on first-contact when memory would
    // pick recognition would strand the surface out of sync.
    const orraLineFromRestored = selectOrraRecognitionLine(state.npcs.orra.memory);
    state.npcs.orra.lastLineId = typeof restored.npcs.orra.lastLineId === "string"
      ? restored.npcs.orra.lastLineId
      : orraLineFromRestored.lineId;
    state.npcs.orra.lastLine = typeof restored.npcs.orra.lastLine === "string"
      ? restored.npcs.orra.lastLine
      : lineCopyForOrraLineId(orraLineFromRestored.lineId);
    // #1173 done-gate: keep lastLineMemoryRefs in lockstep with lastLineId so
    // the served page exposes Orra's citation on restore just like on mint.
    state.npcs.orra.lastLineMemoryRefs = Array.isArray(restored.npcs.orra.lastLineMemoryRefs)
      ? restored.npcs.orra.lastLineMemoryRefs.filter((entry) => typeof entry === "string")
      : (state.npcs.orra.lastLineId === ORRA_FIRST_CONTACT_LINE_ID
          ? []
          : [state.npcs.orra.lastLineId]);
  }
  if (restored.save && typeof restored.save === "object") {
    state.save = { ...emptySave(), ...restored.save };
  }
  markStateDirty();
  renderText();
  publishState();
};

const {
  scene,
  camera,
  raycaster,
  pointer,
  renderer,
  composer,
  bloomPass,
  signLight,
  playerMesh,
  kiosk,
  screen,
  slotMesh,
  io,
  rain,
  kioskHitTargets,
  resize,
} = (() => {
  const kioskScene = createKioskScene(canvas);
  kioskSceneInitContract = kioskScene.sceneInitContract;
  return kioskScene;
})();

const handleScenePointer = (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.interaction.lastPointer = {
    x: Math.round(event.clientX - rect.left),
    y: Math.round(event.clientY - rect.top),
  };
  markStateDirty();
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObjects(kioskHitTargets, false).length > 0) {
    event.preventDefault();
    deliverPacket("scene-kiosk-pointer");
  } else {
    publishState();
  }
};

const pressedKeys = new Set();
const syncKeyboardInput = () => {
  const x = Number(pressedKeys.has("KeyD") || pressedKeys.has("ArrowRight")) - Number(pressedKeys.has("KeyA") || pressedKeys.has("ArrowLeft"));
  const z = Number(pressedKeys.has("KeyS") || pressedKeys.has("ArrowDown")) - Number(pressedKeys.has("KeyW") || pressedKeys.has("ArrowUp"));
  setMoveInput(x, z, x || z ? "keyboard" : "none");
};

mobileMovePadController = attachMobileMovePad({
  root: movePad,
  knob: movePadKnob,
  onInput: setMobileMovePadInput,
  feel: MOBILE_MOVE_PAD,
});
syncMobileMovePad();

attachRuntimeInputAdapters({
  packetButton,
  acknowledgeRouteButton,
  skipRouteButton,
  deliverButton,
  canvas,
  document,
  window,
  state,
  IO_RETURN_TONE_OPTIONS,
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  packetPress,
  packetMove,
  packetRelease,
  handleScenePointer,
  choose,
  markStateDirty,
  markPointerIntent,
});
window.addEventListener("keydown", (event) => {
  pressedKeys.add(event.code);
  syncKeyboardInput();
});
window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
  syncKeyboardInput();
});
soundButton.addEventListener("click", enableAudio);
resetButton.addEventListener("click", resetSliceSave);
window.addEventListener("resize", resize, { passive: true });

// Background-open guard listener: fire an immediate hasFocus:false tick
// the moment the tab is hidden so the packet-intent controller freezes
// the hold in-flight, rather than waiting for the next rAF (which may
// never come while hidden, then batch-catches-up on resume — the exact
// path that used to commit OPENED without a real hold). packetTick
// already threads document.hidden into the controller; this just makes
// sure a snapshot lands at the visibility edge.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.interaction.packetIntent.active) {
    packetTick(performance.now());
  }
});

// #957: returning-session boot recognition. A restored DELIVERED save
// opens with Io acknowledging the return. The delivery-outcome fact's
// `object` is the packet outcome; the route-attention fact (via
// secondActionFromMemory) maps done→listened / skipped→skipped. A
// delivered save WITHOUT the outcome fact is a bare return —
// chooseIoReturningSessionLine({}) yields the bareReturn line.
armReturningSessionBootLine(Boolean(stored?.packet?.delivered));

// Boot complete: listeners wired + Io's kiosk line rendered. The scene
// is interactive (scene.ready) and her intro has been seen — a restored
// save keeps whatever it already recorded (#564 Phase 1).
state.scene.ready = true;
if (!state.player.flags.io_intro_seen) {
  state.player.flags.io_intro_seen = true;
  markStateDirty();
}
renderText();
publishState();
resize();

let last = performance.now();
const tick = (now) => {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  // #1128: consume any pending recognition arm on the first tick that
  // actually fires. Stamping to rAF's `now` (not wall-clock at the
  // synchronous input.choose() moment) means the burst window is
  // measured from the FIRST composited frame — cold-start rAF
  // starvation can no longer make elapsedMs skip past the 67-333ms
  // burst window before any tick runs.
  if (pendingRecognitionArm) {
    memoryRecognitionBeatStartedAt = now;
    pendingRecognitionArm = false;
    framesDuringRecognitionBeat = 0;
  }
  stepMovementFixed(dt);
  const t = now / 1000;
  const kioskPulse = state.interaction.kioskPulse;
  const confirmStartedAt = state.interaction.confirmStartedAt;
  const failureStartedAt = state.interaction.failureStartedAt;
  const packetIntentSnapshot = state.interaction.packetIntent.active ? packetTick(now) : state.interaction.packetIntent;
  const packetProgress = packetIntentSnapshot.progress;
  const confirmEnvelope = confirmStartedAt === null
    ? interactionConfirmEnvelopeAt(CONFIRM_FEEDBACK.durationMs, CONFIRM_FEEDBACK)
    : interactionConfirmEnvelopeAt(now - confirmStartedAt, CONFIRM_FEEDBACK);
  const confirmProgress = confirmEnvelope.progress;
  const confirmFalloff = confirmEnvelope.falloff;
  const confirmWobble = confirmEnvelope.wobble;
  const failureReducedMotion = prefersReducedMotion();
  const failureEnvelope = failureStartedAt === null
    ? failureStingEnvelopeAt(FAILURE_FEEDBACK.durationMs, FAILURE_FEEDBACK, {
        reducedMotion: failureReducedMotion,
      })
    : failureStingEnvelopeAt(now - failureStartedAt, FAILURE_FEEDBACK, {
        reducedMotion: failureReducedMotion,
      });
  const failureFalloff = failureEnvelope.falloff;
  const failureWobble = failureEnvelope.wobble;

  playerMesh.position.set(state.player.x, 0, state.player.z);
  playerMesh.rotation.y = state.player.facingRadians;
  kiosk.rotation.y = Math.sin(t * 0.6) * 0.025 + confirmWobble * 0.045;
  kiosk.scale.setScalar(1 + kioskPulse * 0.018 + confirmFalloff * 0.012);
  io.position.y = Math.sin(t * 1.7) * 0.025;
  const recognitionMotion = recognitionMotionAt(now);
  if (memoryRecognitionBeatStartedAt !== null) framesDuringRecognitionBeat += 1;
  syncRecognitionDomFeedback(now);
  impactBurstParticles = recognitionMotion.impactBurst.particles;
    syncImpactBurstDom(impactBurstParticles);
  if (recognitionMotion.impactBurst.chirp.shouldTrigger) {
    const chirpKey = Math.round((now - memoryRecognitionBeatStartedAt) * 1000) / 1000;
    if (lastImpactBurstChirpAt !== chirpKey) {
      lastImpactBurstChirpAt = chirpKey;
      triggerRecognitionImpactChirp(recognitionMotion.impactBurst.chirp);
    }
  }
  const rig = stepCameraRig(dt);
  camera.position.x = rig.position.x + recognitionMotion.cameraDeltaMeters + confirmWobble * state.interaction.confirmFeedback.cameraKickWorldX - failureWobble * FAILURE_FEEDBACK.cameraKickWorldX;
  camera.position.y = rig.position.y;
  camera.position.z = rig.position.z;
  camera.lookAt(rig.lookAt.x, rig.lookAt.y, rig.lookAt.z);
  camera.rotation.z += THREE.MathUtils.degToRad(recognitionMotion.cameraYawDegrees + confirmWobble * state.interaction.confirmFeedback.cameraKickDeg - failureWobble * FAILURE_FEEDBACK.cameraKickDeg);
  sampleMemoryBeatCameraProbe();
  document.documentElement.style.setProperty("--confirm-shake-x", `${confirmEnvelope.hudShakeX - Math.round(failureWobble * FAILURE_FEEDBACK.hudShakePx)}px`);
  document.documentElement.style.setProperty("--confirm-shake-y", `${confirmEnvelope.hudLiftY + Math.round(failureFalloff * FAILURE_FEEDBACK.hudDropPx)}px`);
  document.documentElement.style.setProperty("--confirm-reticle-scale", `${confirmEnvelope.reticleScale.toFixed(3)}`);
  document.documentElement.style.setProperty("--confirm-reticle-y", `${confirmEnvelope.reticleLiftPx.toFixed(2)}px`);
  if (failureSting) {
    failureSting.style.opacity = `${failureEnvelope.flashAlpha.toFixed(3)}`;
  }
  screen.material.emissiveIntensity = 1.55 + Math.sin(t * 3.2) * 0.25 + kioskPulse * 1.2 + confirmFalloff * 0.7 + packetProgress * 0.65;
  slotMesh.material.emissiveIntensity = 0.7 + kioskPulse * 1.5 + confirmFalloff * 0.45 + packetProgress * 0.4;
  signLight.intensity = 7.4 + Math.sin(t * 2.4) * 0.8 + kioskPulse * 2.4 + confirmFalloff * 1.3 + recognitionMotion.signGlowBoost + packetProgress * 1.1;
  state.interaction.kioskPulse = Math.max(0, kioskPulse - dt * CONFIRM_FEEDBACK.pulseDecayPerSecond);
  if (confirmStartedAt !== null) {
    state.interaction.confirmFeedback.active = confirmProgress < 1;
    state.interaction.confirmFeedback.remainingMs = Math.max(0, Math.round(CONFIRM_FEEDBACK.durationMs - (now - confirmStartedAt)));
    if (confirmProgress >= 1) {
      state.interaction.confirmStartedAt = null;
    }
  }
  if (failureStartedAt !== null) {
    // Contract (packet-hold-threshold.spec.ts:42-52): failureFeedback is
    // `InteractionFeedback & { hudDropPx, flashAlpha, wobbleCycles, easing }`
    // where flashAlpha is the PINNED feel constant (0.34) — asserted with
    // `.toBe(0.34)`. Merging the full envelope leaks time-varying scaled
    // amplitudes (falloff * feel.flashAlpha, wobble, vignetteAlpha, …) into
    // the contract surface and flips the pinned value. Only fold runtime
    // *lifecycle* fields into state; the render call site already reads
    // scaled amplitudes off `failureEnvelope` directly (see failureSting
    // opacity above), so nothing else needs the per-frame values persisted.
    state.interaction.failureFeedback.active = failureEnvelope.active;
    state.interaction.failureFeedback.remainingMs = failureEnvelope.remainingMs;
    if (!failureEnvelope.active) {
      state.interaction.failureStartedAt = null;
    }
  }
  if (rainFilter) {
    rainFilter.frequency.value = 1280 + Math.sin(t * 0.7) * 180;
  }
  if (kioskHum) {
    kioskHum.frequency.value = 89 + Math.sin(t * 0.45) * 3;
  }
  rain.children.forEach((drop, index) => {
    drop.position.y -= dt * (4.4 + (index % 5) * 0.38);
    if (drop.position.y < -2) {
      drop.position.y = 7.5;
    }
  });

  renderText();
  publishState();
  composer.render();
  // Pointer-to-render close-out: any `pointerdown` intent that
  // came in this frame gets folded into a sample against
  // `performance.now()` NOW that `composer.render()` has flushed
  // the pixels. This is the "played, not driven" half of the
  // feel contract — every real tap the player performs is
  // measured against the one-frame promise via the same primitive
  // the harness (bootWindowGame.ts) uses for its synthetic drives.
  drainPointerIntentsForRenderedFrame(performance.now());
  requestAnimationFrame(tick);
};

requestAnimationFrame(tick);
