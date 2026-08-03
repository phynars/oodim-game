// AFTERSIGN packet choice feel contract.
//
// The slice's first real choice is physical: preserve the blue seal or break it.
// This module keeps that decision out of generic menu-click territory by making
// accidental taps, drags, and tiny holds non-committal. It is pure data so the
// renderer and harness can share the same timing contract.
//
// Release-forgiveness (PR #994): a finger-up frame that lands one or two
// frames short of the hard threshold is almost always the player's intent —
// their finger lifted a couple of ms before the frame boundary they were
// aiming at. Under the sharp thresholds alone that gets punished as
// "inspect-only" (open) or nothing (preserve). This module now imports
// `DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.releaseGraceMs` from the pure-lane
// feel-contract module and uses it as the grace window on both sides of the
// hold judgement. The pure module's `runPacketChoiceReleaseForgivenessChecks`
// pins the SAME grace under the state-machine API, so the input surface and
// the contract cannot drift.

import { DEFAULT_PACKET_CHOICE_RELEASE_CONFIG } from "../../../../aftersign/src/feel/packetChoiceReleaseForgiveness";

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
  /**
   * A finger-up frame that lands within this many ms of the hard hold
   * threshold still commits — accounts for the frame-boundary between
   * "intended to release" and "actually released". Pinned by the pure
   * release-forgiveness contract module.
   */
  releaseGraceMs: number;
};

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  openHoldMs: 420,
  maxCommitTravelPx: 10,
  preserveTapMaxMs: 180,
  releaseGraceMs: DEFAULT_PACKET_CHOICE_RELEASE_CONFIG.releaseGraceMs,
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

  // Open-side release forgiveness: a hold that ends up to `releaseGraceMs`
  // short of `openHoldMs` still counts as an intentional open. This mirrors
  // aftersign/src/feel/packetChoiceReleaseForgiveness.ts's
  // `checkReleaseOnFirstEligibleOpenFrameCommits` — releasing on the first
  // eligible frame (or a hair before) still commits.
  const openHoldForgivenMs = Math.max(0, config.openHoldMs - config.releaseGraceMs);
  if (gesture.kind === "hold" && gesture.durationMs >= openHoldForgivenMs) {
    return {
      choice: "opened",
      committed: true,
      feedback: "seal-break",
      reason: "hold-opened",
    };
  }

  // Preserve-side release forgiveness: a tap that overruns `preserveTapMaxMs`
  // by up to `releaseGraceMs` is still the "quick tap" preserve intent.
  // Symmetric with the open side; keeps the two committed outcomes' grace
  // windows in lockstep with the pure contract module.
  const preserveTapForgivenMs = config.preserveTapMaxMs + config.releaseGraceMs;
  if (gesture.kind === "tap" && gesture.durationMs <= preserveTapForgivenMs) {
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
