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
