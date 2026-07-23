import {
  DELIVER_PACKET_CONFIRM_FEEL,
} from "../../../../packages/aftersign/src/interactionConfirm";

export type AftersignPacketOutcome = "sealed" | "opened";

export type AftersignSceneId = "kiosk" | "io-return";

export type AftersignVerticalSliceState = {
  scene: AftersignSceneId;
  packetOutcome: AftersignPacketOutcome | null;
  ioHasMetPlayer: boolean;
  ioRecognizesPlayer: boolean;
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
