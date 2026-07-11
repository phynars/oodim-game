// AFTERSIGN packet choice feel contract.
//
// The slice's first real choice is physical: preserve the blue seal or break it.
// This module keeps that decision out of generic menu-click territory by making
// accidental taps, drags, and tiny holds non-committal. It is pure data so the
// renderer and harness can share the same timing contract.

export type PacketChoice = "sealed" | "opened";

export type PacketGestureKind = "tap" | "hold" | "drag" | "cancel";

export type PacketChoiceGesture = {
  kind: PacketGestureKind;
  durationMs: number;
  travelPx: number;
  startedOnSeal: boolean;
  endedOnSeal: boolean;
};

export type PacketChoiceDecision = {
  choice: PacketChoice | null;
  committed: boolean;
  feedback: "none" | "inspect" | "seal-strain" | "seal-break" | "seal-safe";
  reason:
    | "not-on-seal"
    | "cancelled"
    | "dragged-away"
    | "inspect-only"
    | "hold-opened"
    | "tap-preserved";
};

export type PacketChoiceFeelConfig = {
  /** Minimum deliberate press to break the seal. Shorter touches inspect only. */
  openHoldMs: number;
  /** Above this travel, the gesture is movement/aiming, not packet intent. */
  maxCommitTravelPx: number;
  /** A quick tap on the intact seal confirms preservation instead of opening. */
  preserveTapMaxMs: number;
};

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  openHoldMs: 420,
  maxCommitTravelPx: 10,
  preserveTapMaxMs: 180,
};

export function evaluatePacketChoiceGesture(
  gesture: PacketChoiceGesture,
  config: PacketChoiceFeelConfig = DEFAULT_PACKET_CHOICE_FEEL,
): PacketChoiceDecision {
  if (!gesture.startedOnSeal || !gesture.endedOnSeal) {
    return {
      choice: null,
      committed: false,
      feedback: "none",
      reason: "not-on-seal",
    };
  }

  if (gesture.kind === "cancel") {
    return {
      choice: null,
      committed: false,
      feedback: "none",
      reason: "cancelled",
    };
  }

  if (gesture.kind === "drag" || gesture.travelPx > config.maxCommitTravelPx) {
    return {
      choice: null,
      committed: false,
      feedback: "inspect",
      reason: "dragged-away",
    };
  }

  if (gesture.kind === "hold" && gesture.durationMs >= config.openHoldMs) {
    return {
      choice: "opened",
      committed: true,
      feedback: "seal-break",
      reason: "hold-opened",
    };
  }

  if (gesture.kind === "tap" && gesture.durationMs <= config.preserveTapMaxMs) {
    return {
      choice: "sealed",
      committed: true,
      feedback: "seal-safe",
      reason: "tap-preserved",
    };
  }

  return {
    choice: null,
    committed: false,
    feedback: "seal-strain",
    reason: "inspect-only",
  };
}
