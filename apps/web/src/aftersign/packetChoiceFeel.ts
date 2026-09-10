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
  feedback: "none" | "inspect" | "seal-strain" | "seal-break" | "seal-safe" | "previewed";
  reason:
    | "not-on-seal"
    | "cancelled"
    | "dragged-away"
    | "inspect-only"
    | "hold-opened"
    | "tap-preserved"
    | "previewed-glance";
};

export type PacketChoiceFeelConfig = {
  /** Minimum deliberate press to break the seal. Shorter touches inspect only. */
  openHoldMs: number;
  /** Above this travel, the gesture is movement/aiming, not packet intent. */
  maxCommitTravelPx: number;
  /** A quick tap on the intact seal confirms preservation instead of opening. */
  preserveTapMaxMs: number;
  /**
   * A very-quick glance on the seal — shorter than a preserve tap — surfaces
   * a non-committal `previewed` feedback token instead of committing either
   * choice. Mirrors `PACKET_INTENT.PREVIEW_MAX_MS` in the shipped contract
   * (`aftersign/src/packetIntent.ts`), which is the SINGLE source of truth
   * for the preview window. Kept strictly less than `preserveTapMaxMs` so a
   * preview is a subset of a preserve-tap (see
   * `checkPreviewWindowStrictlyInsidePreserveTapWindow`).
   *
   * This is opt-in on the feel-side judge only: the vertical-slice
   * `packetOutcome: 'sealed' | 'opened'` surface (durable save, mloop
   * memory gate, io returning-session lines) is untouched — `previewed`
   * never becomes a committed choice, so downstream state stays typed.
   */
  previewTapMaxMs: number;
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
  // Mirrors `PACKET_INTENT.PREVIEW_MAX_MS` (60ms) in
  // `aftersign/src/packetIntent.ts`. Kept as a literal here rather than
  // imported to avoid pulling the whole pure controller subgraph into
  // the served-surface bundle; the pure lane's
  // `checkPreviewWindowStrictlyInsidePreserveTapWindow` locks the
  // relationship and the jsdom `packetChoicePreviewed.consumer.test.ts`
  // asserts the value used here matches the surfaced feedback path.
  previewTapMaxMs: 60,
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

  // Preview-glance branch (#1701, Refs #1698). A tap inside
  // `previewTapMaxMs` — shorter than the preserve-tap ceiling and well
  // short of `openHoldMs` — is neither a preserve commit nor an open
  // commit: it's the player briefly poking the seal to look at it. We
  // surface a non-committal `previewed` feedback token so the render
  // site can play a light glance beat without touching `packetOutcome`.
  //
  // Emitted only for `kind === "tap"` because a "hold" already implies
  // a longer commit intent — the deliberate-hold branch below owns that
  // path. Fires BEFORE the release-forgiveness tap-preserve branch so a
  // sub-60ms tap doesn't get absorbed into the preserve commit. Above
  // `previewTapMaxMs` the gesture falls through to the existing
  // preserve/inspect logic unchanged.
  if (gesture.kind === "tap" && gesture.durationMs <= config.previewTapMaxMs) {
    return {
      choice: null,
      committed: false,
      feedback: "previewed",
      reason: "previewed-glance",
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
