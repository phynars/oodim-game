// AFTERSIGN — interaction-confirm feel contract for the flagship slice.
//
// Pure-data timing envelope for the first player confirmation tap/key.
// The runtime can sample this without touching DOM/WebGL, and the e2e harness
// can assert the exact feel numbers before the visual scene is complete.

export type InteractionConfirmSample = {
  elapsedMs: number;
  progress: number;
  pressScale: number;
  liftPx: number;
  cameraYawDeg: number;
  screenShakePx: number;
  glowAlpha: number;
  clickGain: number;
};

export const INTERACTION_CONFIRM_FEEL = {
  durationMs: 180,
  pressInMs: 54,
  pressScalePeak: 0.94,
  liftPxPeak: 3.5,
  cameraYawDegPeak: 0.42,
  screenShakePxPeak: 1.25,
  glowAlphaPeak: 0.72,
  clickGainPeak: 0.82,
  easing: "cubic-bezier(.2,.8,.2,1)",
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number): number => {
  const inverse = 1 - clamp01(value);
  return 1 - inverse * inverse * inverse;
};

const easeInQuad = (value: number): number => {
  const t = clamp01(value);
  return t * t;
};

export function sampleInteractionConfirmFeel(elapsedMs: number): InteractionConfirmSample {
  const safeElapsedMs = Math.max(0, elapsedMs);
  const progress = clamp01(safeElapsedMs / INTERACTION_CONFIRM_FEEL.durationMs);
  const pressProgress = clamp01(safeElapsedMs / INTERACTION_CONFIRM_FEEL.pressInMs);
  const releaseProgress = clamp01(
    (safeElapsedMs - INTERACTION_CONFIRM_FEEL.pressInMs) /
      (INTERACTION_CONFIRM_FEEL.durationMs - INTERACTION_CONFIRM_FEEL.pressInMs),
  );

  const pressIn = easeOutCubic(pressProgress);
  const release = easeOutCubic(releaseProgress);
  const hold = 1 - release;
  const tail = 1 - easeInQuad(progress);

  return {
    elapsedMs: safeElapsedMs,
    progress,
    pressScale: 1 - (1 - INTERACTION_CONFIRM_FEEL.pressScalePeak) * pressIn * hold,
    liftPx: INTERACTION_CONFIRM_FEEL.liftPxPeak * pressIn * hold,
    cameraYawDeg: INTERACTION_CONFIRM_FEEL.cameraYawDegPeak * Math.sin(progress * Math.PI) * tail,
    screenShakePx: INTERACTION_CONFIRM_FEEL.screenShakePxPeak * hold * tail,
    glowAlpha: INTERACTION_CONFIRM_FEEL.glowAlphaPeak * pressIn * tail,
    clickGain: safeElapsedMs <= 24 ? INTERACTION_CONFIRM_FEEL.clickGainPeak : 0,
  };
}
