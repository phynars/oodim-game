import {
  IO_NEXT_JOB_OFFER,
  ORRA_NAME_DEBT,
  type IoNextJobBeat,
} from "../../../../../packages/aftersign/src/narrative-triage/io-recognition-beat";
// Memory-branched job-offer copy. Selected here so the served-surface
// snapshot at `story.nextJob.offer.copy` carries the flagship strings
// (title / ioLine / actionLabel / summary / risk prompt / route labels)
// the consuming scene renderer paints — a fresh boot sees the safe
// first-run copy, a sealed-packet return sees the "trusted" branch,
// an opened-packet return sees the "wax debt" branch. Kept as a JS
// module so the frozen copy stays legible to non-TS reviewers; the
// harness is the sole importer and this file is the ship-side consumer
// #1404's reviewer asked for.
import {
  chooseAftersignJobOfferCopy,
  type AftersignJobOfferCopy,
} from "../aftersignJobOfferCopy.js";
import { measurePointerToRenderLatency } from "../../../../../aftersign/src/inputAcknowledgeLatency";
import {
  AFTERSIGN_ASK_FOR_NEXT_JOB,
  AFTERSIGN_CHOOSE_RETURN_TONE,
} from "../issue1199ChoiceHandlers";
import {
  getMemoryRecallFeel,
  type MemoryRecallFeelFrame,
} from "../memoryRecallFeel";
import { playAftersignRememberingNpcRecognitionFeel } from "../verticalSliceRememberingNpcInteraction";
import {
  getAftersignNextJobOfferFeel,
  type AftersignNextJobOfferFeelFrame,
} from "../nextJobOfferFeel";
import type { AftersignReturnReason } from "../ioVoiceContract";
import {
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
  applyAftersignReturnToneChoiceFeel,
  getAftersignReturnToneChoiceFeel,
  type AftersignReturnToneChoiceFeel,
} from "../returnToneChoiceFeel";
import {
  buildIoContinueBeats,
  type IoContinueBeat,
} from "../story/ioContinueBeats";
import {
  assertAftersignTapChoiceSurfaces,
  type AftersignTapChoiceSurfaceReport,
} from "../tapChoiceFeel";
import {
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  applyFlagshipTapConfirmFeel,
  FLAGSHIP_TAP_CONFIRM_FEEL as FLAGSHIP_TAP_CONFIRM_FEEL_ROW,
  type AftersignTapConfirmFeel,
} from "../tapConfirmFeel";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignNextJobRequest,
  recordAftersignReturnToneChoice,
  resolveAftersignRememberingNpcDialogue,
  restoreAftersignDurableSave,
  type AftersignRememberedTone,
  type AftersignRememberingNpcDialogue,
  type AftersignRememberingNpcId,
  type AftersignStoryStateSnapshot,
  type AftersignVerticalSliceState,
} from "../verticalSliceState";
import type { IoJobOffer } from "../../../../../packages/aftersign/src/computeOfferedJobs";

/**
 * Player-memory the returning NPC references on recognition — the
 * two axes a round-trip beat needs beyond `packetOutcome`: the
 * player's chosen name and the count of prior interactions. Fed in
 * by `setPlayerMemory` and forwarded to
 * `createAftersignWindowGameSurface` as `options.npcMemoryRoundTrip`
 * so the SHIPPED surface (not the harness) publishes
 * `story.npcMemoryRoundTrip`. Kept as its own shape (not folded
 * into `AftersignVerticalSliceState`) because it's a projection the
 * harness owns — the runtime state doesn't yet author these fields.
 */
export type AftersignPlayerMemoryInput = {
  playerName: string;
  interactionCount: number;
};

/**
 * Recall-beat trigger emitted by `meetNpc` when a *previously-met* NPC
 * transitions from `hasMet` → `recognizesPlayer` on this call. The
 * scene renderer feeds each animation frame's `elapsedMs` (millis since
 * `firedAtMs`) into `recallFeel()` to sample the envelope for that
 * frame — halo scale, caption lift, camera yaw, bloom, audio, haptic.
 *
 * `firedAtMs` is the timestamp captured at the moment of recognition
 * so the renderer's own clock (`performance.now()`, `Date.now()`, or a
 * fixed test clock) can compute `elapsedMs = now - firedAtMs` without
 * the harness owning a scheduler.
 */
export type AftersignRecallTrigger = {
  npcId: "io" | "orra";
  firedAtMs: number;
};

export type AftersignRecallFeelOptions = {
  /**
   * Milliseconds since the trigger fired. Callers typically compute
   * this as `now - trigger.firedAtMs`; the harness clamps <0 to the
   * dormant frame and >durationMs to the tail of the held phase.
   */
  elapsedMs: number;
  /**
   * When true, camera yaw / caption lift / halo scale are trimmed and
   * haptic is suppressed, per `MEMORY_RECALL_FEEL`'s reduced-motion
   * contract. Defaults to false.
   */
  reducedMotion?: boolean;
};

/**
 * Pointer-to-render feel-contract sample. Shape is the harness-surface
 * projection of `PointerToRenderMeasurement` from
 * `aftersign/src/inputAcknowledgeLatency.ts` — same arithmetic, fields
 * renamed to the surface vocabulary (`pointerAtMs / renderedAtMs /
 * deltaMs / withinBudget`) so a consumer test doesn't have to know
 * about the primitive's `receivedAtMs / withinOneFrame` names.
 *
 * `frameBudgetMs` is 16.7 (one 60 Hz frame, physically honest —
 * 16.6667…ms rounded to one decimal). The primitive's default budget
 * is 16 (integer), so the harness passes 16.7 explicitly.
 */
export type PointerToRenderLatencySample = {
  pointerAtMs: number;
  renderedAtMs: number;
  deltaMs: number;
  frameBudgetMs: number;
  withinBudget: boolean;
};

export type PointerToRenderLatencyReport = {
  latest?: PointerToRenderLatencySample;
  worst?: PointerToRenderLatencySample;
  samples: PointerToRenderLatencySample[];
};

/**
 * One 60 Hz frame in milliseconds, one decimal. The primitive's default
 * (`INPUT_ACKNOWLEDGE_LATENCY.FRAME_BUDGET_MS`) rounds this to 16 — the
 * harness passes 16.7 explicitly so a 16 ms sample lands INSIDE the
 * budget (deltaMs=16, withinBudget=true) instead of on the edge.
 */
const POINTER_TO_RENDER_FRAME_BUDGET_MS = 16.7;

export type AftersignWindowGameHarness = {
  version: 1;
  restoreDurableSave: (payload: string) => void;
  meetNpc: (id: "io" | "orra") => void;
  /**
   * Record the posture the player struck when Io asked why they came
   * back — third axis on the return beat, per `ioVoiceContract.ts`.
   * Populating this makes the next `getStoryState()` snapshot include
   * the full three-line `ioDialogue.memoryThread.thread` (route +
   * packet + return-reason). Pass `null` to clear.
   *
   * Side effect (return-tone FEEL wiring): when `reason` is non-null
   * and the document contains an element matching
   * `AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR` (i.e.
   * `[data-aftersign-return-surface]`), the harness stamps the feel
   * row (`AFTERSIGN_RETURN_TONE_CHOICE_FEEL[reason]`) onto that
   * element via `applyAftersignReturnToneChoiceFeel`. That's the
   * seam that turns the pure feel table into runnable slice code —
   * the same reason token drives BOTH the voice memory thread and
   * the DOM press envelope.
   */
  setIoReturnReason: (reason: AftersignReturnReason | null) => void;
  /**
   * Return the most recent return-tone feel row applied by
   * `setIoReturnReason`, or `null` when no non-null reason has been
   * recorded (or the last call was `setIoReturnReason(null)`).
   * Exposed so a consumer test can assert the wiring without having
   * to mount the `[data-aftersign-return-surface]` DOM node — the
   * feel row is the ground truth, the DOM write is the projection.
   */
  getAppliedReturnToneFeel: () => AftersignReturnToneChoiceFeel | null;
  /**
   * Return the two-beat continue sequence Io speaks after the player
   * strikes a return posture: her REPLY line for that posture, then
   * the invariant NEXT-JOB handoff (red tag → Saint Orra). Sourced
   * from `story/ioContinueBeats.ts` — the harness never authors the
   * lines inline. Returns `null` when no posture is recorded yet
   * (`setIoReturnReason` has never been called with a non-null value,
   * or was last called with `null`).
   *
   * NOTE — the shipped-surface consumer of `ioContinueBeats.ts` is
   * `aftersign/main.js::lineForBeat()` (PR #1236), which renders the
   * REPLY line at `return-tone-choice` and the HANDOFF line at
   * `io-next-job` into `#line`. `main.js` is what publishes
   * `window.__game` at the served URL; this file is the vitest boot
   * harness. This snapshot accessor is a TEST-ONLY read of the same
   * pure module (kept so `ioContinueBeats.consumer.test.ts` can
   * assert the two-beat sequence without walking the DOM), so the
   * posture drives the VOICE (main.js) and the FEEL (`getAppliedReturnToneFeel()`)
   * in lock-step at the served URL and is mirrored here for tests.
   */
  getIoContinueBeats: () =>
    | readonly [IoContinueBeat, IoContinueBeat]
    | null;
  /**
   * Measure every mounted tap-choice surface
   * (`[data-aftersign-tap-choice]`) against the 44px minimum touch
   * target and return the report. This is the consumer that turns
   * `tapChoiceFeel.ts` from a pure primitive into a runtime contract
   * on the live DOM — a scene renderer that ships a 40px button
   * regresses this assertion before the player ever mis-taps.
   *
   * DOM-optional: in a worker / SSR / no-document context the
   * report describes zero surfaces (vacuously ok). Consumer tests
   * mount real elements with real rects and assert `.ok` /
   * `.failures[].label`.
   */
  getTapChoiceFeelReport: () => AftersignTapChoiceSurfaceReport;
  /**
   * Return the most recent tap-confirm feel row applied by
   * `input.choose(...)`, or `null` when no committing choice has been
   * made yet this session. This is the seam that turns
   * `tapConfirmFeel.ts` into runnable slice code — every tap that
   * commits a fork (packet-seal, return-tone posture, ask-for-next-job,
   * accept-next-job) stamps the flagship confirm envelope onto the
   * `[data-aftersign-tap-choice="<choiceId>"]` element AND records the
   * applied row here so a consumer test can assert the wiring without
   * mounting a DOM node.
   *
   * Cleared to `null` on `restoreDurableSave` / `load` (a fresh boot
   * has no in-flight confirm to inherit).
   */
  getAppliedTapConfirmFeel: () => AftersignTapConfirmFeel | null;
  /**
   * Accept Io's next-job offer. The returned beat is the canonical
   * copy from `io-recognition-beat.ts`; the harness also stores it so
   * `getStoryState()` / `getSnapshot()` expose the accepted job on the
   * served-page surface.
   */
  acceptNextJob: () => IoNextJobBeat;
  /**
   * Sample the next-job offer envelope that makes Io's red-tag handoff
   * feel like a physical object entering the player's hands. Renderers
   * call this after the `io-next-job` line appears — i.e. once the
   * player has requested the next job via
   * `input.choose("ask-for-next-job")` (which stamps
   * `state.hasAskedForNextJob === true` through
   * `recordAftersignNextJobRequest`). The feel is DECOUPLED from
   * `acceptNextJob()`: the envelope is what the player sees the
   * moment Io produces the red tag, not what fires after they
   * accept it. Returns `null` before the request has been recorded.
   */
  nextJobOfferFeel: (options: { elapsedMs: number; reducedMotion?: boolean }) => AftersignNextJobOfferFeelFrame | null;
  /**
   * Served-page style input surface. `choose("accept-next-job")` is an
   * alias for `acceptNextJob()`. `choose("choose-return-tone")` and
   * `choose("ask-for-next-job")` advance the M-CONTINUE-E1 beat axis
   * (`return-tone-choice` → `io-next-job`) through the runtime-state
   * recorders used by the story beat resolver.
   *
   * Pointer-to-render probe (`resetPointerToRenderLatency`,
   * `markPointerIntent`, `markPointerRendered`,
   * `getPointerToRenderLatencyReport`) — a harness-only feel-contract
   * for the one-frame promise. `markPointerIntent` records the timestamp
   * at which a pointer event was accepted; `markPointerRendered` closes
   * the loop when the frame that reflects that pointer's effect ships
   * pixels. Under the hood this defers to
   * `measurePointerToRenderLatency` from
   * `aftersign/src/inputAcknowledgeLatency.ts` with a 16.7 ms budget
   * (one 60 Hz frame, physically honest), reshapes the primitive's
   * `receivedAtMs / latencyMs / withinOneFrame` into the surface shape
   * `pointerAtMs / deltaMs / withinBudget`, and folds the sample into a
   * running report (`samples[]`, `latest`, `worst` — where worst is the
   * MAX `deltaMs` seen this session so a regression is loud).
   * `resetPointerToRenderLatency` drops the samples and any pending
   * intents.
   */
  input: {
    choose: (choiceId: "accept-next-job" | "choose-return-tone" | "ask-for-next-job" | string) => IoNextJobBeat | null;
    resetPointerToRenderLatency: () => void;
    markPointerIntent: (input: { pointerAtMs: number; pointerId: number }) => void;
    markPointerRendered: (input: { renderedAtMs: number; pointerId: number }) => void;
    getPointerToRenderLatencyReport: () => PointerToRenderLatencyReport;
  };
  getAcceptedNextJob: () => IoNextJobBeat | null;
  /**
   * Return the deterministic job-id set the memory-divergence
   * primitive (`packages/aftersign/src/computeOfferedJobs.ts`)
   * derives from the currently-recorded `playerMemory`. Mirrors
   * `snapshot.story.offeredJobIds` — same call, exposed as a
   * top-level accessor so a consumer test can assert #1382's
   * primitive is actually wired to a player-visible surface
   * without walking the whole snapshot.
   *
   * Fresh boot (no `setPlayerMemory` yet) → `[SAFE_DEFAULT_JOB_ID]`.
   * Returning boot with `interactionCount >= 1` → the completed-
   * loop divergent set. Same freshness / determinism guarantees
   * as the primitive.
   */
  getOfferedJobIds: () => IoJobOffer[];
  getStoryState: () => AftersignStoryStateSnapshot;
  /**
   * Served-page-compatible alias for the story/state snapshot. E2E
   * callers should not need to know whether the surface is backed by
   * the in-memory harness or the runtime page module.
   */
  getSnapshot: () => AftersignStoryStateSnapshot;
  /**
   * Serialize the current vertical-slice state into the durable-save
   * envelope used by the runtime page. The harness owns a deterministic
   * turn counter so save→load round-trips can be asserted without a
   * browser storage dependency.
   */
  save: () => string;
  /**
   * Restore a durable-save envelope through the same path as
   * `restoreDurableSave`, using the shorter served-surface verb.
   */
  load: (payload: string) => void;
  /**
   * The most recent recall trigger captured by `meetNpc`, or `null`
   * when no NPC has recognized the player yet this session. A fresh
   * meet without prior memory (first contact) does NOT fire a
   * trigger — recall is a *return*-beat feel.
   */
  getRecallTrigger: () => AftersignRecallTrigger | null;
  /**
   * Sample the memory-recall envelope for the active trigger at
   * `elapsedMs`. Returns `null` when no trigger is active (renderer
   * should skip the recall pass). Otherwise returns the same frame
   * shape `getMemoryRecallFeel` produces — captionOpacity, haloScale,
   * cameraYawDeg, bloomGain, audioGain, hapticMs, phase.
   */
  recallFeel: (options: AftersignRecallFeelOptions) => MemoryRecallFeelFrame | null;
  /**
   * Return the dialogue the remembering NPC (`"io"` or `"orra"`) would
   * speak against the current runtime state. Sources every string from
   * `packages/aftersign/src/ioReturningSession.ts` and the web-side
   * first-session copy — the harness never authors dialogue inline.
   *
   * On first contact this returns the NPC's first-session line; on a
   * post-restore return (`recognizesPlayer === true`) it returns the
   * canonical returning-session line for the remembered fork.
   */
  getRememberingNpcDialogue: (
    npc: AftersignRememberingNpcId,
  ) => AftersignRememberingNpcDialogue;
  /**
   * Record the returning-player memory the NPC recognition beat
   * references: the player's chosen name and the count of prior
   * interactions. When set, the next `getStoryState()` snapshot taken
   * AFTER a recall trigger fires (i.e. `meetNpc` promotes an NPC to
   * `recognizes-player`) exposes `story.npcMemoryRoundTrip` with the
   * canonical returning-session line composed against these two
   * axes. Pass `null` to clear.
   *
   * The memory is persisted through `save()` / `load()` so a
   * durable-save round-trip that carries these fields into a fresh
   * boot still emits the round-trip beat on the next recognition.
   */
  setPlayerMemory: (memory: AftersignPlayerMemoryInput | null) => void;
};

declare global {
  interface Window {
    __game?: AftersignWindowGameHarness;
  }
}

const HARNESS_PLAYER = {
  playerId: "harness-player",
  playerName: "Harness Player",
  rememberedSessionIds: [] as string[],
};

const WINDOW_GAME_SAVE_KIND = "aftersign.windowGameHarnessSave.v1";

type AftersignWindowGameSaveEnvelope = {
  kind: typeof WINDOW_GAME_SAVE_KIND;
  durableSave: string;
  acceptedNextJobId: IoNextJobBeat["id"] | null;
  /**
   * Persisted so a save() → load() round-trip that carried the
   * returning-player memory bag re-emits the round-trip beat on the
   * next recognition meet. Missing / null on saves taken before
   * `setPlayerMemory` was called.
   */
  playerMemory: AftersignPlayerMemoryInput | null;
};

const isPlayerMemoryInput = (
  value: unknown,
): value is AftersignPlayerMemoryInput => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.playerName === "string" &&
    typeof record.interactionCount === "number" &&
    Number.isFinite(record.interactionCount)
  );
};

const encodeWindowGameSave = (
  durableSave: string,
  acceptedNextJob: IoNextJobBeat | null,
  playerMemory: AftersignPlayerMemoryInput | null,
): string =>
  JSON.stringify({
    kind: WINDOW_GAME_SAVE_KIND,
    durableSave,
    acceptedNextJobId: acceptedNextJob?.id ?? null,
    playerMemory,
  } satisfies AftersignWindowGameSaveEnvelope);

const decodeWindowGameSave = (
  payload: string,
): {
  durableSave: string;
  acceptedNextJob: IoNextJobBeat | null;
  playerMemory: AftersignPlayerMemoryInput | null;
} => {
  try {
    const parsed = JSON.parse(payload) as Partial<AftersignWindowGameSaveEnvelope>;
    if (parsed.kind === WINDOW_GAME_SAVE_KIND && typeof parsed.durableSave === "string") {
      return {
        durableSave: parsed.durableSave,
        acceptedNextJob: parsed.acceptedNextJobId === ORRA_NAME_DEBT.id ? ORRA_NAME_DEBT : null,
        playerMemory: isPlayerMemoryInput(parsed.playerMemory) ? parsed.playerMemory : null,
      };
    }
  } catch {
    // Plain durable-save payloads are still accepted below.
  }

  return { durableSave: payload, acceptedNextJob: null, playerMemory: null };
};

const ensureWindow = (): Window => {
  const maybeWindow = (globalThis as { window?: Window }).window;
  if (maybeWindow) {
    return maybeWindow;
  }

  const createdWindow = {} as Window;
  (globalThis as { window: Window }).window = createdWindow;
  return createdWindow;
};

/**
 * Best-effort monotonic clock. `performance.now()` in browsers &
 * jsdom, `Date.now()` as a fallback. The harness only uses this to
 * timestamp recall triggers — callers pass their own `elapsedMs` to
 * `recallFeel`, so the choice of clock only affects the *baseline*
 * the renderer subtracts from.
 */
const nowMs = (): number => {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf && typeof perf.now === "function") {
    return perf.now();
  }
  return Date.now();
};

export const bootAftersignWindowGame = (): AftersignWindowGameHarness => {
  let state: AftersignVerticalSliceState = createAftersignVerticalSliceState();
  let recallTrigger: AftersignRecallTrigger | null = null;
  let ioReturnReason: AftersignReturnReason | null = null;
  let appliedReturnToneFeel: AftersignReturnToneChoiceFeel | null = null;
  let appliedTapConfirmFeel: AftersignTapConfirmFeel | null = null;
  let acceptedNextJob: IoNextJobBeat | null = null;
  let savedAtTurn = 0;
  let playerMemory: AftersignPlayerMemoryInput | null = null;

  // Pointer-to-render probe state. `pendingIntents` matches intent →
  // render by pointerId (the primitive requires event.id === signal.id;
  // we stringify the numeric pointerId at the boundary). `latencySamples`
  // is the running report; `worstLatencySample` is the max-deltaMs seen
  // so a regression stays loud even after a good sample lands after it.
  const pendingPointerIntents = new Map<number, number>();
  let pointerLatencySamples: PointerToRenderLatencySample[] = [];
  let worstPointerLatencySample: PointerToRenderLatencySample | null = null;

  const resetPointerToRenderLatency = (): void => {
    pendingPointerIntents.clear();
    pointerLatencySamples = [];
    worstPointerLatencySample = null;
  };

  const markPointerIntent = (input: { pointerAtMs: number; pointerId: number }): void => {
    pendingPointerIntents.set(input.pointerId, input.pointerAtMs);
  };

  const markPointerRendered = (input: { renderedAtMs: number; pointerId: number }): void => {
    const pointerAtMs = pendingPointerIntents.get(input.pointerId);
    if (pointerAtMs === undefined) {
      // No matching intent — the render signal is orphaned. Silently
      // ignore rather than throw: a jittery renderer that fires an
      // extra `rendered` after a reset shouldn't crash the probe.
      return;
    }
    pendingPointerIntents.delete(input.pointerId);

    const id = `pointer-${input.pointerId}`;
    const measurement = measurePointerToRenderLatency(
      { id, receivedAtMs: pointerAtMs },
      { id, renderedAtMs: input.renderedAtMs },
      POINTER_TO_RENDER_FRAME_BUDGET_MS,
    );
    const sample: PointerToRenderLatencySample = {
      pointerAtMs: measurement.receivedAtMs,
      renderedAtMs: measurement.renderedAtMs,
      deltaMs: measurement.latencyMs,
      frameBudgetMs: measurement.frameBudgetMs,
      withinBudget: measurement.withinOneFrame,
    };
    pointerLatencySamples.push(sample);
    if (
      worstPointerLatencySample === null ||
      sample.deltaMs > worstPointerLatencySample.deltaMs
    ) {
      worstPointerLatencySample = sample;
    }
  };

  const getPointerToRenderLatencyReport = (): PointerToRenderLatencyReport => {
    const latest = pointerLatencySamples[pointerLatencySamples.length - 1];
    const report: PointerToRenderLatencyReport = {
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

  // Played-not-driven wiring: attach a capture-phase `pointerdown`
  // listener to the document so a real `dispatchEvent(new
  // PointerEvent("pointerdown"))` on a tap surface — the way a
  // Playwright tap or a jsdom consumer test would drive the seam —
  // populates the probe automatically, without a harness caller
  // hand-calling `markPointerIntent`. This mirrors the SHIPPED
  // wiring in `aftersign/main.js`, where the served page's real
  // `pointerdown` listener + rAF `composer.render()` drain closes
  // the loop. `bootAftersignWindowGame` runs at module import in
  // vitest (`import "./harness/bootWindowGame"` at the top of a
  // consumer spec), so the listener is armed before any test-side
  // `dispatchEvent` call. DOM-optional: guarded by
  // `typeof document !== "undefined"` so worker/SSR imports don't
  // throw.
  //
  // Visibility guard: BOTH this listener AND the served page's
  // (see aftersign/main.js's `document.addEventListener("pointer-
  // down", ...)` — same 6-space indent, same shape) gate the probe
  // on a VISIBLE `[data-aftersign-tap-choice]` surface. Any other
  // pointerdown (canvas taps, packet gesture, mobile move-pad,
  // decorative buttons, hidden/aria-hidden trays) bubbles through
  // to this capture-phase listener too but must NOT populate the
  // latency probe — else a background-tap regression could silently
  // green the one-frame promise. Keeping the guard identical on
  // both sides is what makes the "mirrors the SHIPPED wiring"
  // claim honest: a vitest consumer test asserts the same
  // pass/reject shape the served page enforces.
  //
  // CI retrigger note (PR #1316): the first CI run on this diff
  // went red on `io-recognition-return-visual-feel.spec.ts`'s
  // duration-bound assertion (line 194 — `BEAT_LIMITS.durationMs.max`),
  // an unrelated SwiftShader cold-start flake documented at
  // #700/#506/#590/#766/#1113/#1134. That spec drives the beat via
  // `game.input.choose(...)` and never dispatches a `pointerdown`,
  // so it cannot be reached by this visibility guard — the failure
  // is a WebGL-lane flake on the same shape retries:3 in
  // `aftersign/playwright.config.ts` was already sized for. This
  // comment exists solely to retrigger CI so the flake either
  // clears or repeats deterministically; the diff itself has no
  // causal path to that step.
  const boundDocument =
    (globalThis as { document?: Document }).document ?? null;
  if (boundDocument && typeof boundDocument.addEventListener === "function") {
    boundDocument.addEventListener(
      "pointerdown",
      (event: Event) => {
        const pointerEvent = event as PointerEvent;
        if (typeof pointerEvent.pointerId !== "number") {
          return;
        }

        const target = event.target as Element | null;
        const choiceSurface = target?.closest?.(
          AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
        ) as HTMLElement | null;
        if (!choiceSurface || choiceSurface.hidden || choiceSurface.getAttribute("aria-hidden") === "true") {
          return;
        }

        markPointerIntent({
          pointerAtMs: nowMs(),
          pointerId: pointerEvent.pointerId,
        });
      },
      { capture: true, passive: true } as AddEventListenerOptions,
    );
  }

  const applyMeet = (
    id: "io" | "orra",
    previous: AftersignVerticalSliceState,
  ): AftersignVerticalSliceState => {
    const next =
      id === "io" ? meetIoForAftersignSlice(previous) : meetOrraForAftersignSlice(previous);

    // Recognition fires on the SECOND meet — i.e. the transition
    // `!prev.recognizes && next.recognizes`. First contact skips the
    // recall envelope (nothing to remember yet). Clearing a prior
    // trigger on a first-contact meet keeps the harness honest: only
    // one recall beat is "live" at a time, and it's always the most
    // recent recognition transition.
    const wasRecognizing =
      id === "io" ? previous.ioRecognizesPlayer : previous.orraRecognizesPlayer;
    const isRecognizing = id === "io" ? next.ioRecognizesPlayer : next.orraRecognizesPlayer;

    if (!wasRecognizing && isRecognizing) {
      recallTrigger = { npcId: id, firedAtMs: nowMs() };
    }

    return next;
  };

  /**
   * Build the surface-options bag from the harness's live posture.
   * `npcMemoryRoundTrip` is forwarded ONLY when a recall trigger has
   * fired AND `playerMemory` has been supplied — either gate empty
   * and the shipped surface (`getAftersignStoryState`) simply
   * omits `story.npcMemoryRoundTrip`. The harness no longer grafts
   * the field on after the surface returns; the surface itself is
   * the sole author, sourcing `spokenLine` verbatim from
   * `resolveAftersignRememberingNpcDialogue` (authored copy).
   */
  const surfaceOptions = () => ({
    ...HARNESS_PLAYER,
    ...(ioReturnReason ? { returnReason: ioReturnReason } : {}),
    ...(playerMemory
      ? {
          // Feed the same harness memory bag through to
          // `computeOfferedJobs` so `story.offeredJobIds` reflects
          // divergent selection whenever `setPlayerMemory` has been
          // called this session. The surface's
          // `deriveOfferedJobsPlayerMemory` mapping owns the
          // interactionCount → priorOutcome translation.
          offeredJobsMemory: {
            playerName: playerMemory.playerName,
            interactionCount: playerMemory.interactionCount,
          },
        }
      : {}),
    ...(recallTrigger && playerMemory
      ? {
          npcMemoryRoundTrip: {
            npcId: recallTrigger.npcId,
            playerName: playerMemory.playerName,
            interactionCount: playerMemory.interactionCount,
          },
        }
      : {}),
  });

  const snapshot = (): AftersignStoryStateSnapshot => {
    const base = getAftersignStoryState(state, surfaceOptions());

    if (!acceptedNextJob) {
      return base;
    }

    return {
      ...base,
      story: {
        ...base.story,
        nextJob: {
          accepted: true,
          offer: {
            id: IO_NEXT_JOB_OFFER.id,
            speaker: IO_NEXT_JOB_OFFER.speaker,
            text: IO_NEXT_JOB_OFFER.text,
            jobId: IO_NEXT_JOB_OFFER.jobId,
            claimTag: IO_NEXT_JOB_OFFER.claimTag,
            nextBeat: IO_NEXT_JOB_OFFER.nextBeat,
              // Memory-branched flagship copy for the next-job handoff.
              // Selected against the current vertical-slice state so
              // the served-page consumer paints the "safe first run",
              // "trusted return", or "wax debt repair" strings without
              // the harness authoring lines inline. Copy source lives
              // in `aftersignJobOfferCopy.js` (frozen).
              copy: chooseAftersignJobOfferCopy({
                firstPacketOutcome: state.packetOutcome,
                packetOpened: state.packetOutcome === "opened",
                deliveredSealed: state.packetOutcome === "sealed",
              }),
          },
          beat: {
            id: ORRA_NAME_DEBT.id,
            speaker: ORRA_NAME_DEBT.speaker,
            text: ORRA_NAME_DEBT.text,
            jobId: ORRA_NAME_DEBT.jobId,
            claimTag: ORRA_NAME_DEBT.claimTag,
          },
        },
      },
    } as AftersignStoryStateSnapshot;
  };

  const restorePayload = (payload: string): void => {
    state = restoreAftersignDurableSave(payload);
    // A durable-save restore is a load, not a meet — no recall
    // envelope fires until the player actually re-encounters the
    // NPC via `meetNpc`.
    recallTrigger = null;
    acceptedNextJob = null;
    // Clear the returning-player memory bag on a bare durable-save
    // restore. The window-game `load()` wrapper re-hydrates it from
    // the envelope AFTER calling this helper — only a full
    // window-game envelope carries the memory bag across restores.
    playerMemory = null;
    // A fresh boot/load has no in-flight tap-confirm envelope to
    // inherit. Keep this aligned with the public surface contract on
    // `getAppliedTapConfirmFeel()` so stale press feedback from a
    // prior choice cannot leak across restore boundaries.
    appliedTapConfirmFeel = null;
    // Return-reason / applied feel row are deliberately NOT reset
    // here — a caller who set a posture BEFORE a durable-save restore
    // may want to carry that posture through the restore (the surface
    // gates `memoryThread.thread` on `packetOutcome`, so if the
    // restore lands a fresh state the thread naturally disappears
    // without a harness-side reset). Consumer tests use
    // `setIoReturnReason(null)` explicitly in `beforeEach` for
    // deterministic isolation — see `returnToneChoiceFeel.consumer.test.ts`.
  };

  /**
   * Apply the return-tone feel row for `reason` to any DOM element
   * marked with `[data-aftersign-return-surface]`. Called from
   * `setIoReturnReason` — the same posture token that drives the
   * voice memory thread ALSO drives the press envelope, so a caller
   * never has to know both surfaces exist.
   *
   * DOM-optional: in a jsdom or no-DOM context (worker, SSR) where
   * `document` is missing OR no surface element is mounted, the feel
   * row is still recorded on `appliedReturnToneFeel` so a test that
   * cares about the wiring (not the render) can assert against it.
   */
  const applyReturnToneFeel = (
    reason: AftersignReturnReason | null,
  ): AftersignReturnToneChoiceFeel | null => {
    if (reason === null) {
      return null;
    }
    // Ground-truth lookup is DOM-free — the feel row is authoritative
    // whether or not a surface element is mounted. Consumers that only
    // assert the wiring (not the render) read this directly via
    // `getAppliedReturnToneFeel()`.
    const feel = getAftersignReturnToneChoiceFeel(reason);
    // Best-effort DOM projection: if the document is present AND a
    // surface element is mounted, stamp the CSS vars onto it. Any
    // throw from the writer (detached-node quirks, jsdom edge cases,
    // a stub document without style/dataset) is swallowed — the
    // ground-truth `feel` still lands on `appliedReturnToneFeel`, so
    // the harness stays honest and the shipped-voice-thread test
    // that only cares about `ioReturnReason` remains unaffected by
    // any DOM-write failure.
    const doc =
      (globalThis as { document?: Document }).document ?? undefined;
    if (doc) {
      try {
        const surface = doc.querySelector(
          AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
        ) as HTMLElement | null;
        if (surface) {
          applyAftersignReturnToneChoiceFeel(surface, reason);
        }
      } catch {
        // Swallow — the DOM write is a projection, not the ground
        // truth. `feel` is returned unconditionally below.
      }
    }
    return feel;
  };

  const acceptNextJob = (): IoNextJobBeat => {
    acceptedNextJob = ORRA_NAME_DEBT;
    return IO_NEXT_JOB_OFFER;
  };

  const api: AftersignWindowGameHarness = {
    version: 1,
    restoreDurableSave(payload) {
      restorePayload(payload);
    },
    meetNpc(id) {
      state = applyMeet(id, state);
    },
    setIoReturnReason(reason) {
      ioReturnReason = reason;
      if (reason !== null) {
        // M-CONTINUE-E2: `AftersignReturnReason` shares its three
        // tokens with `AftersignRememberedTone`, so the same posture
        // that drives the voice memory thread + press-envelope also
        // durably stamps the runtime state — one axis, three consumers.
        state = recordAftersignReturnToneChoice(
          state,
          reason as AftersignRememberedTone,
        );
      }
      appliedReturnToneFeel = applyReturnToneFeel(reason);
    },
    getAppliedReturnToneFeel() {
      return appliedReturnToneFeel;
    },
    getIoContinueBeats() {
      if (ioReturnReason === null) {
        return null;
      }
      return buildIoContinueBeats(ioReturnReason);
    },
    getAppliedTapConfirmFeel: () => appliedTapConfirmFeel,
    getTapChoiceFeelReport() {
      // Sourced from the live DOM each call so the report is always
      // a fresh measurement — a renderer that mounts / unmounts /
      // resizes choice buttons never sees a stale report. The reader
      // is pure (no state written); safe to call at any beat.
      const doc =
        (globalThis as { document?: Document }).document ?? null;
      return assertAftersignTapChoiceSurfaces(doc);
    },
    acceptNextJob,
    nextJobOfferFeel({ elapsedMs, reducedMotion }) {
      // Gate on the DOCUMENTED trigger: the `io-next-job` line has
      // appeared iff the player has asked for the next job (which
      // `recordAftersignNextJobRequest` records as
      // `state.hasAskedForNextJob = true`). Accepting the job is a
      // LATER beat; gating on `acceptedNextJob` would delay the
      // envelope to the wrong frame. See #1255 review.
      if (state.hasAskedForNextJob !== true) {
        return null;
      }
      return getAftersignNextJobOfferFeel({ elapsedMs, reducedMotion });
    },
    input: {
      choose(choiceId) {
        // Flagship tap-confirm FEEL wiring: every committing choice
        // stamps the confirm envelope onto the tap-choice surface
        // whose `data-aftersign-tap-choice` attribute matches this
        // choiceId, and records the applied row so
        // `getAppliedTapConfirmFeel()` sees ground truth even when
        // no DOM node is mounted. DOM-optional and non-throwing —
        // the FEEL is a projection; the STATE update below is the
        // ground truth for beat progression.
        try {
          appliedTapConfirmFeel = null;
          const doc = (globalThis as { document?: Document }).document;
          if (doc && typeof doc.querySelectorAll === "function") {
            // Find the choice-specific surface by walking every
            // mounted tap-choice element and matching on the
            // attribute value. A single-selector query with an
            // interpolated attribute would need `CSS.escape` to be
            // safe against odd choice ids; the enumeration is a
            // handful of buttons on any given screen, so a manual
            // filter is cheaper than the escape.
            const nodes = Array.from(
              doc.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
            ) as HTMLElement[];
            const surface = nodes.find(
              (el) =>
                el.getAttribute("data-aftersign-tap-choice") === choiceId,
            );
            if (surface) {
              appliedTapConfirmFeel = applyFlagshipTapConfirmFeel(surface);
            } else if (nodes.length > 0) {
              // Fall back to the FIRST tap-choice surface mounted —
              // covers slice code that hasn't yet stamped choiceId
              // onto the attribute (e.g. transitional mock surfaces).
              appliedTapConfirmFeel = applyFlagshipTapConfirmFeel(nodes[0]);
            } else {
              // No surface at all — still record the row so a
              // consumer test can assert the seam fired.
              appliedTapConfirmFeel = FLAGSHIP_TAP_CONFIRM_FEEL_ROW;
            }
          } else {
            appliedTapConfirmFeel = FLAGSHIP_TAP_CONFIRM_FEEL_ROW;
          }
        } catch {
          // Never let the FEEL projection break the STATE update
          // below — the story beat progression is the ground truth.
        }

        if (choiceId === "accept-next-job") {
          return acceptNextJob();
        }
        if (choiceId === AFTERSIGN_CHOOSE_RETURN_TONE) {
          // Prefer the posture the caller struck via
          // `setIoReturnReason(reason)`; fall back to `"evasive"` — the
          // mildest posture — when a caller advances the beat without
          // striking one. Matches the fallback in
          // `story/ioContinueBeats.ts::getIoReturnToneReply`.
          const tone: AftersignRememberedTone =
            (ioReturnReason as AftersignRememberedTone | null) ??
            state.rememberedTone ??
            "evasive";
          state = recordAftersignReturnToneChoice(state, tone);
          return null;
        }
        if (choiceId === AFTERSIGN_ASK_FOR_NEXT_JOB) {
          state = recordAftersignNextJobRequest(state);
          return null;
        }
        return null;
      },
      resetPointerToRenderLatency,
      markPointerIntent,
      markPointerRendered,
      getPointerToRenderLatencyReport,
    },
    getAcceptedNextJob() {
      return acceptedNextJob;
    },
    getOfferedJobIds() {
      // Read through the shipped surface so the harness accessor and
      // the served-page snapshot share ONE derivation — a divergence
      // here would silently green a test that shouldn't pass. The
      // surface already publishes a fresh array per call.
      return snapshot().story.offeredJobIds;
    },
    getStoryState() {
      return snapshot();
    },
    getSnapshot() {
      return snapshot();
    },
    save() {
      savedAtTurn += 1;
      return encodeWindowGameSave(
        encodeAftersignDurableSave(state, savedAtTurn),
        acceptedNextJob,
        playerMemory,
      );
    },
    load(payload) {
      const decoded = decodeWindowGameSave(payload);
      restorePayload(decoded.durableSave);
      acceptedNextJob = decoded.acceptedNextJob;
      // `restorePayload` cleared `playerMemory` above so a bare
      // durable-save load can't leak the previous session's memory
      // bag. Only a full window-game envelope re-hydrates it.
      playerMemory = decoded.playerMemory;
    },
    getRecallTrigger() {
      return recallTrigger;
    },
    recallFeel({ elapsedMs, reducedMotion }) {
      if (!recallTrigger) {
        return null;
      }
      return getMemoryRecallFeel({ elapsedMs, reducedMotion });
    },
    getRememberingNpcDialogue(npc) {
      const dialogue = resolveAftersignRememberingNpcDialogue(state, npc);
      // Runnable slice wiring: the pure resolver stamps the FEEL row
      // onto `dialogue.recognitionFeel`; this side-effect mounts the
      // recognition layer (portrait push-in, ring, subtitle pop,
      // audio-cue delay) onto the live DOM so the beat is observable
      // through the same hook both the served surface and vitest
      // consumer specs drive. DOM-optional: no-ops in worker / SSR.
      // Reduced-motion is sensed via `prefers-reduced-motion` so a
      // scene renderer inherits the OS preference without an extra
      // flag threaded through every caller.
      const media =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function"
          ? window.matchMedia("(prefers-reduced-motion: reduce)")
          : null;
      playAftersignRememberingNpcRecognitionFeel(dialogue, {
        reducedMotion: media?.matches === true,
      });
      return dialogue;
    },
    setPlayerMemory(memory) {
      if (memory === null) {
        playerMemory = null;
        return;
      }
      if (!isPlayerMemoryInput(memory)) {
        throw new Error(
          "Cannot set Aftersign player memory: playerName must be a string and interactionCount a finite number",
        );
      }
      // Freeze the shape at capture time — later mutation of the
      // caller's object shouldn't retroactively edit what the
      // recognition beat spoke.
      playerMemory = {
        playerName: memory.playerName,
        interactionCount: memory.interactionCount,
      };
    },
  };

  ensureWindow().__game = api;
  return api;
};

bootAftersignWindowGame();
