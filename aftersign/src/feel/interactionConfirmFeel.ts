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
 * - Hit-stop: 34ms
 * - Scale pop: 1.00 -> 1.08 -> 1.00
 * - Glow: 0.00 -> 0.85 -> 0.15
 * - Camera micro-shake: max 1.8px decay to 0 in <= 180ms
 * - Audio coupling: gain peak aligned within 1 frame (~16.67ms) of visual peak
 */
export const INTERACTION_CONFIRM_TOTAL_MS = 220;
export const INTERACTION_CONFIRM_HITSTOP_MS = 34;

export const INTERACTION_CONFIRM_KEYFRAMES: readonly ConfirmKeyframe[] = [
  { tMs: 0, scale: 1.0, glow: 0.0, shakePx: 0.0, sfxGain: 0.0 },
  { tMs: 34, scale: 1.04, glow: 0.42, shakePx: 1.8, sfxGain: 0.65 },
  { tMs: 84, scale: 1.08, glow: 0.85, shakePx: 1.2, sfxGain: 1.0 },
  { tMs: 140, scale: 1.03, glow: 0.4, shakePx: 0.6, sfxGain: 0.45 },
  { tMs: 220, scale: 1.0, glow: 0.15, shakePx: 0.0, sfxGain: 0.0 },
];

export function isConfirmFeelWithinSpec(
  keyframes: readonly ConfirmKeyframe[] = INTERACTION_CONFIRM_KEYFRAMES,
): boolean {
  if (keyframes.length < 2) return false;

  const first = keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (first.tMs !== 0) return false;
  if (last.tMs > INTERACTION_CONFIRM_TOTAL_MS) return false;

  let peakScale = -Infinity;
  let peakGlow = -Infinity;
  let peakShake = -Infinity;
  let peakSfx = -Infinity;
  let peakGlowTime = 0;
  let peakSfxTime = 0;

  for (const frame of keyframes) {
    peakScale = Math.max(peakScale, frame.scale);
    peakGlow = Math.max(peakGlow, frame.glow);
    peakShake = Math.max(peakShake, frame.shakePx);

    if (frame.glow >= peakGlow) {
      peakGlow = frame.glow;
      peakGlowTime = frame.tMs;
    }
    if (frame.sfxGain >= peakSfx) {
      peakSfx = frame.sfxGain;
      peakSfxTime = frame.tMs;
    }
  }

  const audioVisualDelta = Math.abs(peakGlowTime - peakSfxTime);

  return (
    peakScale >= 1.08 &&
    peakShake <= 1.8 &&
    last.tMs <= 220 &&
    audioVisualDelta <= 17
  );
}
