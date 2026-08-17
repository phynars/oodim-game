// AFTERSIGN — interaction-confirm STING (audio + bloom pop coupling).
//
// This is the AUDIO-VISUAL sting that fires the instant the player's first
// accept-tap is confirmed by the sim. It sits alongside two sibling
// modules and complements them; it does NOT replace them:
//
//   - `interactionConfirmFeel.ts` — the pure motion envelope (press-scale,
//     yaw, shake, glow). CANONICAL for the tactile side.
//   - `aftersignConfirmFeel.ts`   — the DOM bloom overlay (ring / flash /
//     caption). CANONICAL for the spatial visual bloom.
//   - `aftersignInteractionConfirmSting.ts` (this file) — CANONICAL for
//     the AUDIO chirp coupled with the bloom-pop shape. Locks the numbers
//     the ear hears: 880 Hz start → 660 Hz descending chirp over 90 ms,
//     bloom-pop scale 1.08 with 4 px settle, whole sting 120 ms
//     ease-out-cubic.
//
// The legacy `aftersign/interaction-confirm-feel.js` and
// `aftersign/recognition-beat-feedback.js` sources describe the same
// numbers in imperative JS; this module is the pure-data mirror the
// vitest contract test can pin. When the flagship slice re-wires audio
// via the TS pipeline, it imports THIS spec — not the legacy JS.
//
// Nothing here touches DOM or AudioContext. That plumbing lives in the
// runtime layer. This file is spec-only so `.contract.test.ts` can lock
// the numbers without a browser.

export type AftersignInteractionConfirmStingSpec = Readonly<{
  /** Total sting duration (visual bloom pop + audio tail). */
  durationMs: 120;
  /** Chirp envelope duration; short so the sting reads as a "tick", not a note. */
  chirpDurationMs: 90;
  /** Chirp starts at 880 Hz (A5) — bright, above dialog band. */
  chirpStartHz: 880;
  /** Chirp descends to 660 Hz (E5) — a clean minor-third fall for "confirmed". */
  chirpEndHz: 660;
  /** Peak scale of the bloom pop at 35% of duration. */
  bloomPopScale: 1.08;
  /** Post-pop settle offset in px (used by the caption drift). */
  settlePx: 4;
  /** Easing curve applied to both bloom scale and chirp gain envelope. */
  easing: "ease-out-cubic";
}>;

export const AFTERSIGN_INTERACTION_CONFIRM_STING: AftersignInteractionConfirmStingSpec =
  Object.freeze({
    durationMs: 120,
    chirpDurationMs: 90,
    chirpStartHz: 880,
    chirpEndHz: 660,
    bloomPopScale: 1.08,
    settlePx: 4,
    easing: "ease-out-cubic",
  });

export type AftersignInteractionConfirmStingSample = {
  elapsedMs: number;
  progress: number;
  /** Bloom pop scale at time t; peaks at bloomPopScale at ~35% of durationMs. */
  bloomScale: number;
  /** Chirp frequency Hz at time t; sweeps start → end over chirpDurationMs. */
  chirpHz: number;
  /** Chirp gain envelope 0..1; ease-out-cubic then hard drop after chirpDurationMs. */
  chirpGain: number;
  /** Bloom opacity 0..1; ease-out-cubic to peak then linear fade to 0. */
  bloomOpacity: number;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
};

/**
 * Pure sampler. Given elapsed ms since the tap was confirmed, returns the
 * bloom + chirp sample the runtime plumbs into WebAudio + CSS. Kept in
 * this file so the contract test can pin the peak numbers.
 */
export function sampleAftersignInteractionConfirmSting(
  elapsedMs: number,
  spec: AftersignInteractionConfirmStingSpec = AFTERSIGN_INTERACTION_CONFIRM_STING,
): AftersignInteractionConfirmStingSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / spec.durationMs);
  const chirpProgress = clamp01(safeElapsedMs / spec.chirpDurationMs);

  // Bloom scale — peaks at 35% of duration, then eases back to 1.
  const peakAt = 0.35;
  let bloomScale: number;
  let bloomOpacity: number;
  if (progress <= peakAt) {
    const t = easeOutCubic(progress / peakAt);
    bloomScale = 1 + (spec.bloomPopScale - 1) * t;
    bloomOpacity = t;
  } else {
    const t = easeOutCubic((progress - peakAt) / (1 - peakAt));
    bloomScale = spec.bloomPopScale + (1 - spec.bloomPopScale) * t;
    bloomOpacity = 1 - t;
  }

  // Chirp — linear frequency sweep, ease-out-cubic gain ramp then silence.
  const chirpHz = spec.chirpStartHz + (spec.chirpEndHz - spec.chirpStartHz) * chirpProgress;
  const chirpGain =
    safeElapsedMs >= spec.chirpDurationMs ? 0 : 1 - easeOutCubic(chirpProgress);

  return {
    elapsedMs: safeElapsedMs,
    progress,
    bloomScale,
    chirpHz,
    chirpGain,
    bloomOpacity,
  };
}
