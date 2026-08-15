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
   * Set only when the state came out of a durable-save restore
   * (`restoreAftersignDurableSave`). Carries the turn the envelope was
   * written on so the window-surface snapshot can publish
   * `state.save.savedAtTurn` without re-parsing the envelope. Fresh /
   * in-memory states leave this undefined.
   */
  savedAtTurn?: number;
};

export type AftersignRememberingNpcDialogue = {
  npc: AftersignRememberingNpcId;
  recognizesPlayer: boolean;
  lines: readonly string[];
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
 * M-CONTINUE-E1: mark the returning player as having picked a tone
 * to answer Io in. Idempotent; a no-op if already recorded.
 */
export function recordAftersignReturnToneChoice(
  state: AftersignVerticalSliceState,
): AftersignVerticalSliceState {
  if (state.hasChosenReturnTone) {
    return state;
  }
  return {
    ...state,
    hasChosenReturnTone: true,
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
    const lines = state.ioRecognizesPlayer
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
      recognizesPlayer: state.ioRecognizesPlayer,
      lines,
    };
  }

  const lines = [chooseOrraRecognitionLine(state.orraRecognizesPlayer)];

  return {
    npc,
    recognizesPlayer: state.orraRecognizesPlayer,
    lines,
  };
}

// Re-export the canonical line tables so consumers can build parity
// assertions without reaching across the package boundary themselves.
// The resolver is the only reader that decides WHICH line — but any
// downstream test that wants to compare `dialogue.lines[0]` to the
// authored source can import from the same barrel.
export { ioReturningSessionLines, orraRecognitionLines };
