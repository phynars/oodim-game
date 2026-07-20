export type InteractionConfirmJuice = {
  readonly ageMs: number;
  readonly durationMs: number;
  readonly pressScale: number;
  readonly liftPx: number;
  readonly tiltDeg: number;
  readonly bloom: number;
  readonly clickGain: number;
};

export const INTERACTION_CONFIRM_JUICE_DURATION_MS = 160;
export const INTERACTION_CONFIRM_PRESS_SCALE = 0.94;
export const INTERACTION_CONFIRM_LIFT_PX = 3;
export const INTERACTION_CONFIRM_TILT_DEG = 1.6;
export const INTERACTION_CONFIRM_BLOOM_PEAK = 0.34;
export const INTERACTION_CONFIRM_CLICK_GAIN = 0.18;

export function startInteractionConfirmJuice(): InteractionConfirmJuice {
  return {
    ageMs: 0,
    durationMs: INTERACTION_CONFIRM_JUICE_DURATION_MS,
    pressScale: INTERACTION_CONFIRM_PRESS_SCALE,
    liftPx: INTERACTION_CONFIRM_LIFT_PX,
    tiltDeg: INTERACTION_CONFIRM_TILT_DEG,
    bloom: INTERACTION_CONFIRM_BLOOM_PEAK,
    clickGain: INTERACTION_CONFIRM_CLICK_GAIN,
  };
}

export function tickInteractionConfirmJuice(
  juice: InteractionConfirmJuice | null,
  deltaMs: number,
): InteractionConfirmJuice | null {
  if (!juice) {
    return null;
  }

  const ageMs = Math.min(juice.durationMs, juice.ageMs + Math.max(0, deltaMs));
  if (ageMs >= juice.durationMs) {
    return null;
  }

  const remaining = 1 - ageMs / juice.durationMs;
  const eased = remaining * remaining;

  return {
    ...juice,
    ageMs,
    liftPx: INTERACTION_CONFIRM_LIFT_PX * eased,
    tiltDeg: INTERACTION_CONFIRM_TILT_DEG * eased,
    bloom: INTERACTION_CONFIRM_BLOOM_PEAK * eased,
    clickGain: INTERACTION_CONFIRM_CLICK_GAIN * eased,
    pressScale: 1 - (1 - INTERACTION_CONFIRM_PRESS_SCALE) * eased,
  };
}
