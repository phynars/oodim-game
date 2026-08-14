import {
  DELIVER_PACKET_CONFIRM_FEEL,
} from "../../../../packages/aftersign/src/interactionConfirm";

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

export function resolveAftersignRememberingNpcDialogue(
  state: AftersignVerticalSliceState,
  npc: AftersignRememberingNpcId,
): AftersignRememberingNpcDialogue {
  if (npc === "io") {
    const lines = state.ioRecognizesPlayer
      ? [
          "You came back. The kiosk kept your shape in the glass.",
          state.packetOutcome === "opened"
            ? "Last time, you opened the packet. It still sounds awake."
            : state.packetOutcome === "sealed"
              ? "Last time, you left the packet sealed. Some doors respect that."
              : "Last time, you left before the packet chose a future.",
        ]
      : [
          "First visit? Keep your hand near the light.",
          "The city remembers slowly. I remember faster.",
        ];

    return {
      npc,
      recognizesPlayer: state.ioRecognizesPlayer,
      lines,
    };
  }

  const lines = state.orraRecognizesPlayer
    ? [
        "Back under my sign. Good. I was not finished with you.",
        state.orraAction === "answered-saint-orra"
          ? "You answered Saint Orra once. The answer is still walking beside you."
          : "You heard Saint Orra and kept your mouth shut. That counts too.",
      ]
    : [
        "Name yourself when the sign asks. Not before.",
        "Saint Orra hears the part you meant to hide.",
      ];

  return {
    npc,
    recognizesPlayer: state.orraRecognizesPlayer,
    lines,
  };
}
