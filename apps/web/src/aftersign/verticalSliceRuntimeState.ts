import {
  DELIVER_PACKET_CONFIRM_FEEL,
} from "../../../../packages/aftersign/src/interactionConfirm";
import {
  chooseIoReturningSessionLine,
  chooseOrraRecognitionLine,
  ioReturningSessionLines,
  orraRecognitionLines,
} from "../../../../packages/aftersign/src/ioReturningSession";
import { getIoFirstSessionLine } from "./ioFirstSessionCopy";

export type AftersignPacketOutcome = "sealed" | "opened";
export type AftersignOrraAction = "answered-saint-orra";

export type AftersignSceneId = "kiosk" | "io-return" | "orra-return";
export type AftersignRememberingNpcId = "io" | "orra";
/**
 * M-CONTINUE-E2: the durable posture the returning player struck when
 * answering Io. Same three-token axis as
 * `ioVoiceContract.ts::AftersignReturnReason` and
 * `story/ioContinueBeats.ts::IoContinueTone`; kept as its own alias so
 * the runtime-state module doesn't reach across the ioVoiceContract
 * boundary and consumers can `import type { AftersignRememberedTone }`
 * directly from the vertical-slice barrel.
 */
export type AftersignRememberedTone = "kind" | "evasive" | "blunt";

export type AftersignVerticalSliceState = {
  scene: AftersignSceneId;
  packetOutcome: AftersignPacketOutcome | null;
  ioHasMetPlayer: boolean;
  ioRecognizesPlayer: boolean;
  orraAction: AftersignOrraAction | null;
  orraHasMetPlayer: boolean;
  orraRecognizesPlayer: boolean;
  /**
   * M-CONTINUE-E1 (docs/plan/product-plan.md:194): the returning
   * player has picked a tone to answer Io in, advancing the story
   * past `io-return-recognition` into `return-tone-choice`.
   *
   * Optional so pre-M-CONTINUE saves round-trip unchanged; the
   * story-beat selector treats `undefined` and `false` identically.
   */
  hasChosenReturnTone?: boolean;
  /**
   * M-CONTINUE-E1: the returning player has asked Io for the next
   * job, advancing into the terminal `io-next-job` beat authored in
   * `packages/aftersign/next-job-beat.js`.
   *
   * Optional for the same round-trip reason as `hasChosenReturnTone`.
   */
  hasAskedForNextJob?: boolean;
  /**
   * M-CONTINUE-E2: the exact tone the returning player picked when
   * answering Io after recognition. Set alongside
   * `hasChosenReturnTone`; read by the harness's `getIoContinueBeats`
   * (via `story/ioContinueBeats.ts::buildIoContinueBeats`) so Io's
   * reply LINE matches the posture across a durable-save restore.
   *
   * Optional so pre-M-CONTINUE-E2 saves round-trip unchanged; a
   * legacy state with `hasChosenReturnTone === true` but no
   * `rememberedTone` falls back through `setIoReturnReason(reason)`
   * on the harness side.
   */
  rememberedTone?: AftersignRememberedTone;
  /**
   * Set only when the state came out of a durable-save restore
   * (`restoreAftersignDurableSave`). Carries the turn the envelope was
   * written on so the window-surface snapshot can publish
   * `state.save.savedAtTurn` without re-parsing the envelope. Fresh /
   * in-memory states leave this undefined.
   */
  savedAtTurn?: number;
};

export type AftersignRememberingNpcRecognitionFeel = {
  preLineHoldMs: number;
  portraitPushInPx: number;
  portraitPushInMs: number;
  portraitPushInEasing: "cubic-bezier(0.16, 1, 0.3, 1)";
  recognitionRingDelayMs: number;
  recognitionRingDurationMs: number;
  recognitionRingScale: number;
  recognitionRingOpacity: number;
  subtitlePopDelayMs: number;
  subtitlePopDistancePx: number;
  subtitlePopMs: number;
  subtitlePopEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)";
  audioCueDelayMs: number;
};

export const AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL = {
  preLineHoldMs: 120,
  portraitPushInPx: 14,
  portraitPushInMs: 260,
  portraitPushInEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
  recognitionRingDelayMs: 90,
  recognitionRingDurationMs: 420,
  recognitionRingScale: 1.18,
  recognitionRingOpacity: 0.72,
  subtitlePopDelayMs: 180,
  subtitlePopDistancePx: 8,
  subtitlePopMs: 220,
  subtitlePopEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  audioCueDelayMs: 120,
} as const satisfies AftersignRememberingNpcRecognitionFeel;

export type AftersignRememberingNpcRecognitionEnvelope = {
  elapsedMs: number;
  lineHoldComplete: boolean;
  portraitPushInPx: number;
  recognitionRingScale: number;
  recognitionRingOpacity: number;
  subtitlePopDistancePx: number;
  subtitleOpacity: number;
  audioCueArmed: boolean;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function easeOutExpoish(t: number): number {
  const clamped = clamp01(t);
  return 1 - Math.pow(1 - clamped, 3);
}

function easeOutBack(t: number): number {
  const clamped = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
}

/**
 * Sample the returning-NPC recognition beat at a concrete elapsed time so
 * the served renderer and tests consume one numeric contract instead of
 * re-implementing the timing choreography. Negative/non-finite samples
 * collapse to the opening frame; reduced motion keeps opacity/audio
 * semantics but removes spatial motion and scale pop.
 */
export function sampleAftersignRememberingNpcRecognitionEnvelope(
  elapsedMs: number,
  reducedMotion = false,
): AftersignRememberingNpcRecognitionEnvelope {
  const feel = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;
  const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const portraitT = clamp01(safeElapsedMs / feel.portraitPushInMs);
  const ringT = clamp01(
    (safeElapsedMs - feel.recognitionRingDelayMs) /
      feel.recognitionRingDurationMs,
  );
  const subtitleT = clamp01(
    (safeElapsedMs - feel.subtitlePopDelayMs) / feel.subtitlePopMs,
  );
  const portraitEase = easeOutExpoish(portraitT);
  const subtitleEase = easeOutBack(subtitleT);
  const ringFade = Math.sin(ringT * Math.PI);

  return {
    elapsedMs: safeElapsedMs,
    lineHoldComplete: safeElapsedMs >= feel.preLineHoldMs,
    portraitPushInPx: reducedMotion
      ? 0
      : feel.portraitPushInPx * portraitEase,
    recognitionRingScale: reducedMotion
      ? 1
      : 1 + (feel.recognitionRingScale - 1) * easeOutExpoish(ringT),
    recognitionRingOpacity: feel.recognitionRingOpacity * ringFade,
    subtitlePopDistancePx: reducedMotion
      ? 0
      : feel.subtitlePopDistancePx * (1 - subtitleEase),
    subtitleOpacity: subtitleT,
    audioCueArmed: safeElapsedMs >= feel.audioCueDelayMs,
  };
}

export type AftersignRememberingNpcDialogue = {
  npc: AftersignRememberingNpcId;
  recognizesPlayer: boolean;
  lines: readonly string[];
  recognitionFeel: AftersignRememberingNpcRecognitionFeel | null;
};

/**
 * Type alias for the live packet-confirm feel. Kept as an alias (not a
 * redefinition) so this module cannot drift from the live source in
 * `packages/aftersign/src/interactionConfirm.ts`.
 */
export type AftersignPacketChoiceConfirmFeel = typeof DELIVER_PACKET_CONFIRM_FEEL;

export type AftersignPacketChoiceConfirmBeat = {
  packetOutcome: AftersignPacketOutcome;
  confirmedAtMs: number;
  confirmFeel: AftersignPacketChoiceConfirmFeel;
};

/**
 * Re-export of the live packet-confirm feel.
 */
export const AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL: AftersignPacketChoiceConfirmFeel =
  DELIVER_PACKET_CONFIRM_FEEL;

export function createAftersignVerticalSliceState(): AftersignVerticalSliceState {
  return {
    scene: "kiosk",
    packetOutcome: null,
    ioHasMetPlayer: false,
    ioRecognizesPlayer: false,
    orraAction: null,
    orraHasMetPlayer: false,
    orraRecognizesPlayer: false,
    hasChosenReturnTone: false,
    hasAskedForNextJob: false,
    rememberedTone: undefined,
  };
}

export function recordAftersignPacketChoice(
  state: AftersignVerticalSliceState,
  packetOutcome: AftersignPacketOutcome,
): AftersignVerticalSliceState {
  return {
    ...state,
    packetOutcome,
  };
}

export function recordAftersignOrraAction(
  state: AftersignVerticalSliceState,
  orraAction: AftersignOrraAction,
): AftersignVerticalSliceState {
  return {
    ...state,
    orraAction,
  };
}

/**
 * Commit the player's next-job request (`ask-for-next-job`). Guarded:
 * the M-CONTINUE-E1 flow only offers this choice from the
 * `return-tone-choice` beat, so requesting a next job before the
 * return tone is chosen indicates a wiring bug — throw loudly (same
 * contract style as `confirmAftersignPacketChoice`). Thin guard over
 * `recordAftersignAskedForNextJob`, which owns the state stamp —
 * issues #1198 and #1196 landed the same axis under two vocabularies
 * (`returnToneChosen` vs `hasChosenReturnTone`); the served surface
 * reads `hasChosenReturnTone`/`hasAskedForNextJob`, so that pair is
 * the single axis of record and this guard is the only survivor of
 * the other family.
 */
export function recordAftersignNextJobRequest(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  if (state.hasChosenReturnTone !== true) {
    throw new Error(
      "Cannot record Aftersign next-job request: return tone has not been chosen",
    );
  }
  return recordAftersignAskedForNextJob(state);
}

export function confirmAftersignPacketChoice(
  state: AftersignVerticalSliceState,
  confirmedAtMs: number,
): AftersignPacketChoiceConfirmBeat {
  if (state.packetOutcome !== "sealed" && state.packetOutcome !== "opened") {
    throw new Error(
      "Cannot confirm Aftersign packet choice: packetOutcome is not committed",
    );
  }
  if (!Number.isFinite(confirmedAtMs) || confirmedAtMs < 0) {
    throw new Error(
      "Cannot confirm Aftersign packet choice: confirmedAtMs must be a non-negative finite number",
    );
  }

  return {
    packetOutcome: state.packetOutcome,
    confirmedAtMs,
    confirmFeel: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  };
}

/**
 * M-CONTINUE-E1 / E2: mark the returning player as having picked a
 * tone to answer Io in. Stamps `hasChosenReturnTone` true and, when
 * `rememberedTone` is supplied, persists the exact posture on the
 * runtime state so a `save()` → `load()` round-trip re-emits the
 * same reply LINE via `story/ioContinueBeats.ts::buildIoContinueBeats`.
 *
 * The `rememberedTone` argument defaults to the previously-stamped
 * value (or `"evasive"`, the mildest posture, when no prior tone is
 * on the state) so callers that only need the E1 axis — the beat
 * advance — can invoke this with just `(state)` unchanged.
 * Re-recording is allowed (no idempotent short-circuit) so a caller
 * that struck a posture BEFORE choosing (via `setIoReturnReason`)
 * can commit that posture at choice time.
 */
export function recordAftersignReturnToneChoice(
  state: AftersignVerticalSliceState,
  rememberedTone: AftersignRememberedTone = state.rememberedTone ?? "evasive",
): AftersignVerticalSliceState {
  return {
    ...state,
    hasChosenReturnTone: true,
    rememberedTone,
  };
}

/**
 * M-CONTINUE-E1: mark the returning player as having asked Io for
 * the next job — advances into the terminal `io-next-job` beat.
 * Recording this implies the return-tone choice has been made, so
 * `hasChosenReturnTone` is also stamped here (single source of
 * truth: the beat progression cannot skip return-tone-choice).
 */
export function recordAftersignAskedForNextJob(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  if (state.hasAskedForNextJob) {
    return state;
  }
  return {
    ...state,
    hasChosenReturnTone: true,
    // Preserve the E2 posture across the E1 next-job stamp — the beat
    // advance must not erase the tone the player struck a moment ago.
    rememberedTone: state.rememberedTone,
    hasAskedForNextJob: true,
  };
}

export function meetIoForAftersignSlice(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  return {
    ...state,
    scene: "io-return",
    ioHasMetPlayer: true,
    ioRecognizesPlayer: state.ioHasMetPlayer,
  };
}

export function meetOrraForAftersignSlice(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  return {
    ...state,
    scene: "orra-return",
    orraHasMetPlayer: true,
    orraRecognizesPlayer: state.orraHasMetPlayer,
  };
}

/**
 * Resolve the dialogue a remembering NPC (Io or Orra) speaks for the
 * given runtime state. Every string returned is SOURCED, not authored:
 *
 *   • Io's returning line ← `chooseIoReturningSessionLine` from
 *     `packages/aftersign/src/ioReturningSession.ts` (the harness
 *     asserts those strings verbatim — do not paraphrase).
 *   • Io's first-contact line ← `ioFirstSessionCopy.ts` (the web-side
 *     first-session module Io already opens with).
 *   • Orra's returning + first-contact lines ← `orraRecognitionLines`
 *     from the same aftersign package.
 *
 * This module owns SELECTION (which line for which state), never COPY.
 * If a returning-line rewrite lands, edit the package and both this
 * resolver and every other consumer inherit it. The parity test in
 * `verticalSliceRuntimeState.rememberingNpcDialogue.test.ts` locks the
 * no-drift invariant.
 */
export function resolveAftersignRememberingNpcDialogue(
  state: AftersignVerticalSliceState,
  npc: AftersignRememberingNpcId,
): AftersignRememberingNpcDialogue {
  if (npc === "io") {
    const recognizesPlayer = state.ioRecognizesPlayer;
    const lines = recognizesPlayer
      ? [
          chooseIoReturningSessionLine({
            packetOutcome:
              state.packetOutcome === "opened"
                ? "opened"
                : state.packetOutcome === "sealed"
                  ? "sealed"
                  : undefined,
          }),
        ]
      : [getIoFirstSessionLine("arrival")];

    return {
      npc,
      recognizesPlayer,
      lines,
      recognitionFeel: recognizesPlayer
        ? AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL
        : null,
    };
  }

  const recognizesPlayer = state.orraRecognizesPlayer;
  const lines = [chooseOrraRecognitionLine(recognizesPlayer)];

  return {
    npc,
    recognizesPlayer,
    lines,
    recognitionFeel: recognizesPlayer
      ? AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL
      : null,
  };
}

// Re-export the canonical line tables so consumers can build parity
// assertions without reaching across the package boundary themselves.
// The resolver is the only reader that decides WHICH line — but any
// downstream test that wants to compare `dialogue.lines[0]` to the
// authored source can import from the same barrel.
export { ioReturningSessionLines, orraRecognitionLines };
