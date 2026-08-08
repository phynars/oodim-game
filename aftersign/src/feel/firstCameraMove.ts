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

export interface FirstCameraMoveFeelCheckResult {
  readonly passed: true;
  readonly frameCount: number;
  readonly peakYawDeltaPerFrame: number;
  readonly peakPitchDeltaPerFrame: number;
  readonly peakDollyDeltaPerFrame: number;
  readonly firstMotionMs: number;
  readonly finalFrame: FirstCameraMoveFeelFrame;
}

export const FIRST_CAMERA_MOVE_FEEL: FirstCameraMoveFeelContract = {
  durationMs: 1400,
  sampleRateFps: 60,
  yawDegrees: 17.8,
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

export function checkFirstCameraMoveFeel(
  contract: FirstCameraMoveFeelContract = FIRST_CAMERA_MOVE_FEEL,
): FirstCameraMoveFeelCheckResult {
  assertFinitePositive("durationMs", contract.durationMs);
  assertFinitePositive("sampleRateFps", contract.sampleRateFps);
  assertFinitePositive("mobileSafety.targetFps", contract.mobileSafety.targetFps);

  if (contract.mobileSafety.targetFps !== 60) {
    throw new Error(`first camera move targetFps must stay 60, got ${contract.mobileSafety.targetFps}`);
  }

  if (contract.maximumControlLockMs > 900) {
    throw new Error(`first camera move control lock ${contract.maximumControlLockMs}ms exceeds 900ms feel cap`);
  }

  if (contract.mobileSafety.maxScreenShakePx !== 0) {
    throw new Error(`first camera move must not add screen shake, got ${contract.mobileSafety.maxScreenShakePx}px`);
  }

  const timeline = sampleFirstCameraMoveTimeline(contract);
  const firstFrame = timeline[0];
  const finalFrame = timeline[timeline.length - 1];
  assertFrameEquals("first", firstFrame, {
    yawDegrees: 0,
    pitchDegrees: 0,
    dollyMeters: 0,
    vignetteAlpha: contract.vignetteStartAlpha,
    bloomStrength: contract.bloomStartStrength,
    lowPassHz: contract.audioLowPassStartHz,
  });
  assertFrameEquals("final", finalFrame, {
    yawDegrees: contract.yawDegrees,
    pitchDegrees: contract.pitchDegrees,
    dollyMeters: contract.dollyMeters,
    vignetteAlpha: contract.vignetteEndAlpha,
    bloomStrength: contract.bloomEndStrength,
    lowPassHz: contract.audioLowPassEndHz,
  });

  let peakYawDeltaPerFrame = 0;
  let peakPitchDeltaPerFrame = 0;
  let peakDollyDeltaPerFrame = 0;
  let firstMotionMs = Number.POSITIVE_INFINITY;

  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1];
    const current = timeline[index];
    const yawDelta = Math.abs(current.yawDegrees - previous.yawDegrees);
    const pitchDelta = Math.abs(current.pitchDegrees - previous.pitchDegrees);
    const dollyDelta = Math.abs(current.dollyMeters - previous.dollyMeters);
    peakYawDeltaPerFrame = Math.max(peakYawDeltaPerFrame, yawDelta);
    peakPitchDeltaPerFrame = Math.max(peakPitchDeltaPerFrame, pitchDelta);
    peakDollyDeltaPerFrame = Math.max(peakDollyDeltaPerFrame, dollyDelta);

    if (firstMotionMs === Number.POSITIVE_INFINITY && (yawDelta > 0 || pitchDelta > 0 || dollyDelta > 0)) {
      firstMotionMs = current.timeMs;
    }
  }

  const peakTravelDegreesPerFrame = round3(Math.hypot(peakYawDeltaPerFrame, peakPitchDeltaPerFrame));
  if (peakTravelDegreesPerFrame > contract.mobileSafety.maxCameraTravelDegreesPerFrameAt60fps) {
    throw new Error(
      `first camera move peak camera travel ${peakTravelDegreesPerFrame}deg/frame exceeds ${contract.mobileSafety.maxCameraTravelDegreesPerFrameAt60fps}deg/frame mobile cap`,
    );
  }

  if (firstMotionMs > 34) {
    throw new Error(`first camera move waits ${firstMotionMs}ms before visible motion; cap is 34ms`);
  }

  return {
    passed: true,
    frameCount: timeline.length,
    peakYawDeltaPerFrame: round3(peakYawDeltaPerFrame),
    peakPitchDeltaPerFrame: round3(peakPitchDeltaPerFrame),
    peakDollyDeltaPerFrame: round3(peakDollyDeltaPerFrame),
    firstMotionMs,
    finalFrame,
  };
}

function assertFinitePositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`first camera move ${label} must be > 0, got ${value}`);
  }
}

function assertFrameEquals(
  label: string,
  frame: FirstCameraMoveFeelFrame,
  expected: Omit<FirstCameraMoveFeelFrame, "timeMs">,
): void {
  const mismatches = Object.entries(expected).filter(([key, value]) => frame[key as keyof typeof expected] !== value);
  if (mismatches.length > 0) {
    throw new Error(
      `first camera move ${label} frame drifted: ${mismatches.map(([key, value]) => `${key} expected ${value}, got ${frame[key as keyof typeof expected]}`).join("; ")}`,
    );
  }
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
