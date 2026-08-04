// AFTERSIGN packet choice feel contract.
//
// The slice's first real choice is physical: preserve the blue seal or break it.
// This module keeps that decision out of generic menu-click territory by making
// accidental taps, drags, and tiny holds non-committal. It is pure data so the
// renderer and harness can share the same timing contract.
//
// Release-forgiveness (PR #994 wire-in, re-wired PR #1019): a finger-up frame
// that lands one or two frames short of the hard threshold is almost always
// the player's intent — their finger lifted a couple of ms before the frame
// boundary they were aiming at. Under the sharp thresholds alone that gets
// punished as "inspect-only" (open) or nothing (preserve).
//
// Wiring: the hold-open decision here is not hand-rolled arithmetic on
// `releaseGraceMs` — it actually invokes
// `stepPacketChoiceIntentWithReleaseForgiveness` from the pure aftersign
// state-machine module. The preserve-tap check reuses
// `isReleaseInsideForgivenessWindow` from the same module. Every read of
// `releaseGraceMs` in this file goes through the pure contract; the
// contract's `runPacketChoiceReleaseForgivenessChecks` and this file's
// vitest suite therefore share ONE decision path — they cannot drift.

import {
  DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
  isReleaseInsideForgivenessWindow,
  startPacketChoiceReleaseIntent,
  stepPacketChoiceIntentWithReleaseForgiveness,
} from "../../../../aftersign/src/feel/packetChoiceReleaseForgiveness";

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
   * "intended to release" and "actually released". Sourced from the pure
   * release-forgiveness contract module so the two consumers cannot drift.
   */
  releaseGraceMs: number;
};

export const DEFAULT_PACKET_CHOICE_FEEL: PacketChoiceFeelConfig = {
  openHoldMs: 420,
  maxCommitTravelPx: 10,
  preserveTapMaxMs: 180,
  releaseGraceMs: DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS.releaseGraceMs,
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

  // Open-side release forgiveness: replay the gesture through the pure
  // state machine's `stepPacketChoiceIntentWithReleaseForgiveness`. The
  // gesture judge no longer holds its own `releaseGraceMs` arithmetic —
  // the decision lives in the contract module. Pins the same behaviour
  // asserted by `runPacketChoiceReleaseForgivenessChecks` in
  // aftersign/src/feel/packetChoiceReleaseForgiveness.ts.
  if (gesture.kind === "hold") {
    const origin = { x: 0, y: 0 };
    // Bridge the summarised gesture into the state-machine surface: the
    // pure module treats the open threshold as `openHoldMs` and requires
    // an "inspected" seal for open. A gesture classified as `hold` on the
    // seal is by construction inspected (the seal was under the finger for
    // the full duration), so we pass `inspectedSeal: true`.
    const releaseIntent = startPacketChoiceReleaseIntent(
      "open",
      0,
      origin,
      true,
    );
    const stepped = stepPacketChoiceIntentWithReleaseForgiveness(
      releaseIntent,
      {
        nowMs: gesture.durationMs,
        releasedAtMs: gesture.durationMs,
        pointer: origin,
        pressed: false,
      },
      {
        openHoldMs: config.openHoldMs,
        // Preserve-side confirm hold is unused for the open decision but
        // required by the config type; pass the open threshold as a safe
        // upper bound so it never coincidentally satisfies preserve here.
        preserveConfirmMs: config.openHoldMs,
        cancelRadiusPx: config.maxCommitTravelPx,
        minArmedVisibleMs: 0,
        frameBudgetMs: 16.67,
        releaseGraceMs: config.releaseGraceMs,
      },
    );
    if (stepped.phase === "committed" && stepped.action === "open") {
      return {
        choice: "opened",
        committed: true,
        feedback: "seal-break",
        reason: "hold-opened",
      };
    }
  }

  // Preserve-side release forgiveness: a tap that overruns
  // `preserveTapMaxMs` by up to `releaseGraceMs` is still the "quick tap"
  // preserve intent. Symmetric with the open side; both consult the
  // shared `isReleaseInsideForgivenessWindow` helper so `releaseGraceMs`
  // math lives in ONE place (the pure contract module).
  //
  // The tap-ceiling direction inverts the shortfall relative to the hold
  // case: a tap is "on-time" when its duration is BELOW the ceiling, so
  // we frame the forgiveness as "how far past the ceiling did we land?"
  // and reuse the shared helper by comparing against a zero-shortfall
  // required-hold-of-graceMs.
  if (gesture.kind === "tap") {
    const overrunMs = Math.max(0, gesture.durationMs - config.preserveTapMaxMs);
    // A tap under the ceiling has overrun 0; a tap `releaseGraceMs` past
    // the ceiling has overrun exactly `releaseGraceMs`. The shared helper
    // then answers "is that overrun inside the grace window?".
    if (
      isReleaseInsideForgivenessWindow(
        config.releaseGraceMs - overrunMs,
        config.releaseGraceMs,
        config.releaseGraceMs,
      )
    ) {
      return {
        choice: "sealed",
        committed: true,
        feedback: "seal-safe",
        reason: "tap-preserved",
      };
    }
  }

  return {
    choice: null,
    committed: false,
    feedback: "seal-strain",
    reason: "inspect-only",
  };
}
