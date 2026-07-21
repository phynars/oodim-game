export type EasingName = "easeOutCubic" | "easeInOutSine";

export interface FirstCameraMoveFeelFrame {
  readonly timeMs: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly dollyMeters: number;
  readonly vignetteAlpha: number;
  readonly bloomStrength: number;
  readonly lowPassHz: number;
}

export interface FirstCameraMoveSignGlow {
  readonly riseMs: number;
  readonly holdMs: number;
  readonly fallMs: number;
  readonly peakIntensityMultiplier: number;
}

export interface FirstCameraMoveWetSheenPulse {
  readonly offsetMs: number;
  readonly durationMs: number;
  readonly peakRoughnessDrop: number;
}

export interface FirstCameraMoveAudioCoupling {
  readonly rainDuckDb: number;
  readonly bellHitMs: number;
  readonly signHumFadeInMs: number;
}

export interface FirstCameraMoveMobileSafety {
  readonly maxCameraTravelDegreesPerFrameAt60fps: number;
  readonly maxScreenShakePx: number;
  readonly targetFps: number;
}

export interface FirstCameraMoveFeelContract {
  readonly durationMs: number;
  readonly sampleRateFps: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly dollyMeters: number;
  readonly easing: EasingName;
  readonly audioLowPassStartHz: number;
  readonly audioLowPassEndHz: number;
  readonly bloomStartStrength: number;
  readonly bloomEndStrength: number;
  readonly vignetteStartAlpha: number;
  readonly vignetteEndAlpha: number;
  // Coupled AV beats layered on top of the camera motion. These are
  // authored numbers (not sampled) so the runtime and Playwright can
  // agree on the same envelope. Added 2026-07-21 (PR #748) as the
  // "flagship JUICE bar" extension — folded into this canonical
  // contract instead of a parallel `AFTERSIGN_FIRST_CAMERA_MOVE_FEEL`
  // that would drift.
  readonly maximumControlLockMs: number;
  readonly lanternLeadMs: number;
  readonly signGlow: FirstCameraMoveSignGlow;
  readonly wetSurfaceSheenPulse: FirstCameraMoveWetSheenPulse;
  readonly audioCoupling: FirstCameraMoveAudioCoupling;
  readonly mobileSafety: FirstCameraMoveMobileSafety;
}

export const FIRST_CAMERA_MOVE_FEEL: FirstCameraMoveFeelContract = {
  durationMs: 1400,
  sampleRateFps: 60,
  yawDegrees: 18,
  pitchDegrees: -4,
  dollyMeters: 2.4,
  easing: "easeOutCubic",
  audioLowPassStartHz: 720,
  audioLowPassEndHz: 18000,
  bloomStartStrength: 0.18,
  bloomEndStrength: 0.42,
  vignetteStartAlpha: 0.42,
  vignetteEndAlpha: 0.18,
  maximumControlLockMs: 900,
  lanternLeadMs: 120,
  signGlow: {
    riseMs: 180,
    holdMs: 420,
    fallMs: 260,
    peakIntensityMultiplier: 1.35,
  },
  wetSurfaceSheenPulse: {
    offsetMs: 240,
    durationMs: 520,
    peakRoughnessDrop: 0.16,
  },
  audioCoupling: {
    rainDuckDb: -3,
    bellHitMs: 760,
    signHumFadeInMs: 320,
  },
  mobileSafety: {
    maxCameraTravelDegreesPerFrameAt60fps: 0.65,
    maxScreenShakePx: 0,
    targetFps: 60,
  },
};

export function easeOutCubic(t: number): number {
  const clamped = clamp01(t);
  return 1 - Math.pow(1 - clamped, 3);
}

export function easeInOutSine(t: number): number {
  const clamped = clamp01(t);
  return -(Math.cos(Math.PI * clamped) - 1) / 2;
}

export function sampleFirstCameraMove(
  timeMs: number,
  contract: FirstCameraMoveFeelContract = FIRST_CAMERA_MOVE_FEEL,
): FirstCameraMoveFeelFrame {
  const progress = clamp01(timeMs / contract.durationMs);
  const motion = contract.easing === "easeInOutSine" ? easeInOutSine(progress) : easeOutCubic(progress);
  const atmosphere = easeInOutSine(progress);

  return {
    timeMs: Math.round(progress * contract.durationMs),
    yawDegrees: round3(contract.yawDegrees * motion),
    pitchDegrees: round3(contract.pitchDegrees * motion),
    dollyMeters: round3(contract.dollyMeters * motion),
    vignetteAlpha: round3(lerp(contract.vignetteStartAlpha, contract.vignetteEndAlpha, atmosphere)),
    bloomStrength: round3(lerp(contract.bloomStartStrength, contract.bloomEndStrength, atmosphere)),
    lowPassHz: Math.round(lerp(contract.audioLowPassStartHz, contract.audioLowPassEndHz, atmosphere)),
  };
}

export function sampleFirstCameraMoveTimeline(
  contract: FirstCameraMoveFeelContract = FIRST_CAMERA_MOVE_FEEL,
): FirstCameraMoveFeelFrame[] {
  const frameCount = Math.round((contract.durationMs / 1000) * contract.sampleRateFps);
  return Array.from({ length: frameCount + 1 }, (_, frame) =>
    sampleFirstCameraMove((frame / contract.sampleRateFps) * 1000, contract),
  );
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
