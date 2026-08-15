import {
  IO_NEXT_JOB_OFFER,
  ORRA_NAME_DEBT,
  type IoNextJobBeat,
} from "../../../../../packages/aftersign/src/narrative-triage/io-recognition-beat";
import {
  AFTERSIGN_ASK_FOR_NEXT_JOB,
  AFTERSIGN_CHOOSE_RETURN_TONE,
} from "../issue1199ChoiceHandlers";
import {
  getMemoryRecallFeel,
  type MemoryRecallFeelFrame,
} from "../memoryRecallFeel";
import type { AftersignReturnReason } from "../ioVoiceContract";
import {
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
  applyAftersignReturnToneChoiceFeel,
  getAftersignReturnToneChoiceFeel,
  type AftersignReturnToneChoiceFeel,
} from "../returnToneChoiceFeel";
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
  type AftersignRememberingNpcDialogue,
  type AftersignRememberingNpcId,
  type AftersignStoryStateSnapshot,
  type AftersignVerticalSliceState,
} from "../verticalSliceState";

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
   * Accept Io's next-job offer. The returned beat is the canonical
   * copy from `io-recognition-beat.ts`; the harness also stores it so
   * `getStoryState()` / `getSnapshot()` expose the accepted job on the
   * served-page surface.
   */
  acceptNextJob: () => IoNextJobBeat;
  /**
   * Served-page style input surface. `choose("accept-next-job")` is an
   * alias for `acceptNextJob()`. `choose("choose-return-tone")` and
   * `choose("ask-for-next-job")` advance the M-CONTINUE-E1 beat axis
   * (`return-tone-choice` → `io-next-job`) through the runtime-state
   * recorders used by the story beat resolver.
   */
  input: {
    choose: (choiceId: "accept-next-job" | "choose-return-tone" | "ask-for-next-job" | string) => IoNextJobBeat | null;
  };
  getAcceptedNextJob: () => IoNextJobBeat | null;
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
  let acceptedNextJob: IoNextJobBeat | null = null;
  let savedAtTurn = 0;

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

  const snapshot = (): AftersignStoryStateSnapshot => {
    const base = getAftersignStoryState(state, {
      ...HARNESS_PLAYER,
      ...(ioReturnReason ? { returnReason: ioReturnReason } : {}),
    });

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
      appliedReturnToneFeel = applyReturnToneFeel(reason);
    },
    getAppliedReturnToneFeel() {
      return appliedReturnToneFeel;
    },
    acceptNextJob,
    input: {
      choose(choiceId) {
        if (choiceId === "accept-next-job") {
          return acceptNextJob();
        }
        if (choiceId === AFTERSIGN_CHOOSE_RETURN_TONE) {
          state = recordAftersignReturnToneChoice(state);
          return null;
        }
        if (choiceId === AFTERSIGN_ASK_FOR_NEXT_JOB) {
          state = recordAftersignNextJobRequest(state);
          return null;
        }
        return null;
      },
    },
    getAcceptedNextJob() {
      return acceptedNextJob;
    },
    getStoryState() {
      return snapshot();
    },
    getSnapshot() {
      return snapshot();
    },
    save() {
      savedAtTurn += 1;
      return encodeAftersignDurableSave(state, savedAtTurn);
    },
    load(payload) {
      restorePayload(payload);
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
      return resolveAftersignRememberingNpcDialogue(state, npc);
    },
  };

  ensureWindow().__game = api;
  return api;
};

bootAftersignWindowGame();
