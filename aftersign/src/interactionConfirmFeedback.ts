export type ConfirmFeedbackSample = {
  scale: number;
  glow: number;
  shakeX: number;
  shakeY: number;
  yawDeg: number;
  audioGainDb: number;
  audioLeadMs: number;
  done: boolean;
};

export type ConfirmFeedbackProfile = {
  durationMs: number;
  hitStopFrames: number;
  overshootScale: number;
  settleScale: number;
  shakeAmplitudePx: { x: number; y: number };
  yawDeg: number;
  easing: [number, number, number, number];
  audioLeadMs: number;
  audioPeakGainDb: number;
};

/**
 * Interaction confirm beat contract for AFTERSIGN's vertical-slice input feel.
 *
 * Numbers are intentionally explicit so the touchpoint is tuneable without
 * hunting through animation code:
 * - 180ms total response envelope
 * - 3 frame hit-stop at 60fps (~50ms) before full settle
 * - 6px x / 4px y shake burst, critically damped
 * - 1.6° camera yaw nudge
 * - audio transient leads visual peak by 18ms
 */
export const INTERACTION_CONFIRM_PROFILE: ConfirmFeedbackProfile = {
  durationMs: 180,
  hitStopFrames: 3,
  overshootScale: 1.08,
  settleScale: 1,
  shakeAmplitudePx: { x: 6, y: 4 },
  yawDeg: 1.6,
  easing: [0.2, 0.9, 0.2, 1],
  audioLeadMs: -18,
  audioPeakGainDb: 2.5,
};

export const REDUCED_MOTION_CONFIRM_PROFILE: ConfirmFeedbackProfile = {
  durationMs: 140,
  hitStopFrames: 0,
  overshootScale: 1.02,
  settleScale: 1,
  shakeAmplitudePx: { x: 0, y: 0 },
  yawDeg: 0,
  easing: [0.25, 0.8, 0.25, 1],
  audioLeadMs: -10,
  audioPeakGainDb: 1.5,
};

const TAU = Math.PI * 2;

function normalize(progressMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  if (progressMs <= 0) return 0;
  if (progressMs >= durationMs) return 1;
  return progressMs / durationMs;
}

function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

export function sampleInteractionConfirmFeedback(
  progressMs: number,
  reducedMotion = false,
): ConfirmFeedbackSample {
  const profile = reducedMotion
    ? REDUCED_MOTION_CONFIRM_PROFILE
    : INTERACTION_CONFIRM_PROFILE;

  const t = normalize(progressMs, profile.durationMs);
  const eased = easeOutCubic(t);
  const overshootWeight = 1 - eased;

  const scale =
    profile.settleScale +
    (profile.overshootScale - profile.settleScale) * overshootWeight;

  const shakeEnvelope = (1 - t) * (1 - t);
  const oscillation = Math.sin(t * TAU * 2.5);
  const shakeX = profile.shakeAmplitudePx.x * shakeEnvelope * oscillation;
  const shakeY = profile.shakeAmplitudePx.y * shakeEnvelope * (oscillation * 0.6);

  const yawDeg = profile.yawDeg * shakeEnvelope * 0.75;
  const glow = 0.45 + 0.55 * eased;
  const audioGainDb = profile.audioPeakGainDb * (1 - Math.abs(0.5 - t) * 2);

  return {
    scale,
    glow,
    shakeX,
    shakeY,
    yawDeg,
    audioGainDb,
    audioLeadMs: profile.audioLeadMs,
    done: t >= 1,
  };
}
