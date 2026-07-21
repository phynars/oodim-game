export type AftersignFirstCameraMoveFeel = {
  readonly beatId: "aftersign.firstCameraMove.v1";
  readonly durationMs: number;
  readonly start: {
    readonly distanceMeters: number;
    readonly heightMeters: number;
    readonly yawDegrees: number;
    readonly pitchDegrees: number;
  };
  readonly end: {
    readonly distanceMeters: number;
    readonly heightMeters: number;
    readonly yawDegrees: number;
    readonly pitchDegrees: number;
  };
  readonly easing: "cubic-bezier(0.16, 1, 0.3, 1)";
  readonly maximumControlLockMs: number;
  readonly lanternLeadMs: number;
  readonly signGlow: {
    readonly riseMs: number;
    readonly holdMs: number;
    readonly fallMs: number;
    readonly peakIntensityMultiplier: number;
  };
  readonly wetSurfaceSheenPulse: {
    readonly offsetMs: number;
    readonly durationMs: number;
    readonly peakRoughnessDrop: number;
  };
  readonly audioCoupling: {
    readonly rainDuckDb: number;
    readonly bellHitMs: number;
    readonly signHumFadeInMs: number;
  };
  readonly mobileSafety: {
    readonly maxCameraTravelDegreesPerFrameAt60fps: number;
    readonly maxScreenShakePx: number;
    readonly targetFps: number;
  };
};

export const AFTERSIGN_FIRST_CAMERA_MOVE_FEEL: AftersignFirstCameraMoveFeel = {
  beatId: "aftersign.firstCameraMove.v1",
  durationMs: 1150,
  start: {
    distanceMeters: 6.4,
    heightMeters: 3.1,
    yawDegrees: -18,
    pitchDegrees: -7,
  },
  end: {
    distanceMeters: 3.2,
    heightMeters: 1.85,
    yawDegrees: -4,
    pitchDegrees: -3,
  },
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
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

export function getAftersignFirstCameraMoveFeel(): AftersignFirstCameraMoveFeel {
  return AFTERSIGN_FIRST_CAMERA_MOVE_FEEL;
}
