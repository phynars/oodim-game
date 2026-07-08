export type ConfirmKeyframe = {
  tMs: number;
  scale: number;
  glow: number;
  shakePx: number;
  sfxGain: number;
};

/**
 * Interaction-confirm touchpoint feel spec for AFTERSIGN.
 *
 * Targets (single confirm beat):
 * - Total window: 220ms
 * - Hit-stop: 34ms (first post-zero keyframe lands at exactly this tMs;
 *   scale has already popped and shake is at its peak — the "freeze" is
 *   the visual snap the player reads as impact)
 * - Scale pop: 1.00 -> 1.08 -> 1.00
 * - Glow envelope: peak 0.85, terminal 0.15 (leaves a warm afterimage,
 *   never returns fully to 0 within the window)
 * - Camera micro-shake: max 1.8px, decays to 0 in <= 180ms
 * - Audio coupling: gain peak aligned within 1 frame (~16.67ms) of visual peak
 */
export const INTERACTION_CONFIRM_TOTAL_MS = 220;
export const INTERACTION_CONFIRM_HITSTOP_MS = 34;
export const INTERACTION_CONFIRM_SHAKE_DECAY_MAX_MS = 180;
export const INTERACTION_CONFIRM_GLOW_PEAK = 0.85;
export const INTERACTION_CONFIRM_GLOW_TERMINAL = 0.15;
export const INTERACTION_CONFIRM_SHAKE_MAX_PX = 1.8;
export const INTERACTION_CONFIRM_SCALE_PEAK = 1.08;
export const INTERACTION_CONFIRM_AV_COUPLING_MAX_MS = 17; // ~1 frame @ 60fps

// Small tolerances so floating-point authoring doesn't false-fail the gate.
const EPSILON = 1e-6;

export const INTERACTION_CONFIRM_KEYFRAMES: readonly ConfirmKeyframe[] = [
  { tMs: 0, scale: 1.0, glow: 0.0, shakePx: 0.0, sfxGain: 0.0 },
  { tMs: 34, scale: 1.04, glow: 0.42, shakePx: 1.8, sfxGain: 0.65 },
  { tMs: 84, scale: 1.08, glow: 0.85, shakePx: 1.2, sfxGain: 1.0 },
  { tMs: 140, scale: 1.03, glow: 0.4, shakePx: 0.6, sfxGain: 0.45 },
  { tMs: 180, scale: 1.01, glow: 0.22, shakePx: 0.0, sfxGain: 0.15 },
  { tMs: 220, scale: 1.0, glow: 0.15, shakePx: 0.0, sfxGain: 0.0 },
];

/**
 * Measurable acceptance gate for the interaction-confirm beat.
 *
 * Every target the spec block lists must be checked here — if a target is
 * only in the doc comment and not in this function, the gate is a rubber
 * stamp. Returns true only when the keyframes satisfy ALL of:
 *
 *   1. First frame at tMs=0 with zero state.
 *   2. Last frame at tMs<=220 (total window).
 *   3. Scale peak reaches 1.08 (within EPSILON).
 *   4. Shake peak equals 1.8px and occurs at the hit-stop tMs (34).
 *   5. Shake returns to 0 by tMs<=180 and STAYS at 0 through the tail.
 *   6. Glow peak equals 0.85 (within EPSILON).
 *   7. Glow terminal value equals 0.15 (within EPSILON) — warm afterimage.
 *   8. Audio peak within 1 frame (~17ms) of visual (glow) peak.
 *   9. A keyframe exists at exactly the hit-stop tMs (34).
 */
export function isConfirmFeelWithinSpec(
  keyframes: readonly ConfirmKeyframe[] = INTERACTION_CONFIRM_KEYFRAMES,
): boolean {
  if (keyframes.length < 2) return false;

  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];

  // (1) start clean at t=0
  if (first.tMs !== 0) return false;
  if (
    Math.abs(first.scale - 1.0) > EPSILON ||
    Math.abs(first.glow) > EPSILON ||
    Math.abs(first.shakePx) > EPSILON ||
    Math.abs(first.sfxGain) > EPSILON
  ) {
    return false;
  }

  // (2) total window
  if (last.tMs > INTERACTION_CONFIRM_TOTAL_MS) return false;

  // (9) hit-stop keyframe must exist at exactly INTERACTION_CONFIRM_HITSTOP_MS
  const hitStopFrame = keyframes.find(
    (f) => f.tMs === INTERACTION_CONFIRM_HITSTOP_MS,
  );
  if (!hitStopFrame) return false;

  let peakScale = -Infinity;
  let peakGlow = -Infinity;
  let peakShake = -Infinity;
  let peakSfx = -Infinity;
  let peakGlowTime = 0;
  let peakSfxTime = 0;
  let peakShakeTime = 0;

  for (const frame of keyframes) {
    if (frame.scale > peakScale) peakScale = frame.scale;
    if (frame.glow > peakGlow) {
      peakGlow = frame.glow;
      peakGlowTime = frame.tMs;
    }
    if (frame.shakePx > peakShake) {
      peakShake = frame.shakePx;
      peakShakeTime = frame.tMs;
    }
    if (frame.sfxGain > peakSfx) {
      peakSfx = frame.sfxGain;
      peakSfxTime = frame.tMs;
    }
  }

  // (3) scale peak
  if (peakScale + EPSILON < INTERACTION_CONFIRM_SCALE_PEAK) return false;

  // (4) shake peak magnitude + timing (peak lives at hit-stop)
  if (Math.abs(peakShake - INTERACTION_CONFIRM_SHAKE_MAX_PX) > EPSILON) {
    return false;
  }
  if (peakShakeTime !== INTERACTION_CONFIRM_HITSTOP_MS) return false;

  // (5) shake decay: must hit 0 by tMs<=180 and remain at 0 afterwards
  let shakeZeroTime: number | null = null;
  for (const frame of keyframes) {
    if (frame.tMs <= INTERACTION_CONFIRM_HITSTOP_MS) continue;
    if (shakeZeroTime === null) {
      if (Math.abs(frame.shakePx) <= EPSILON) shakeZeroTime = frame.tMs;
    } else {
      // once shake hits 0 it must stay at 0 through the tail
      if (Math.abs(frame.shakePx) > EPSILON) return false;
    }
  }
  if (shakeZeroTime === null) return false;
  if (shakeZeroTime > INTERACTION_CONFIRM_SHAKE_DECAY_MAX_MS) return false;

  // (6) glow peak
  if (Math.abs(peakGlow - INTERACTION_CONFIRM_GLOW_PEAK) > EPSILON) {
    return false;
  }

  // (7) glow terminal (last frame's glow value)
  if (Math.abs(last.glow - INTERACTION_CONFIRM_GLOW_TERMINAL) > EPSILON) {
    return false;
  }

  // (8) audio-visual coupling
  const audioVisualDelta = Math.abs(peakGlowTime - peakSfxTime);
  if (audioVisualDelta > INTERACTION_CONFIRM_AV_COUPLING_MAX_MS) return false;

  return true;
}
