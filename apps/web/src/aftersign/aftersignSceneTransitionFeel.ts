export type AftersignSceneTransitionPhase =
  | "recognition-settle"
  | "job-offer-rise"
  | "route-commit";

export interface AftersignSceneTransitionFeelPhase {
  readonly id: AftersignSceneTransitionPhase;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly cameraDriftPx: number;
  readonly cameraRollDeg: number;
  readonly vignetteAlpha: number;
  readonly bloomPulseAlpha: number;
  readonly easing: "cubic-bezier(0.16, 1, 0.3, 1)" | "cubic-bezier(0.2, 0.8, 0.2, 1)";
}

export interface AftersignSceneTransitionFeel {
  readonly totalDurationMs: number;
  readonly reducedMotionDurationMs: number;
  readonly phases: readonly AftersignSceneTransitionFeelPhase[];
  readonly audioCoupling: {
    readonly recognitionSettleHz: number;
    readonly jobOfferRiseHz: number;
    readonly routeCommitHz: number;
    readonly gainDb: number;
  };
  readonly acceptance: {
    readonly maxTotalDurationMs: number;
    readonly minCameraDriftPx: number;
    readonly maxCameraRollDeg: number;
    readonly reducedMotionMaxDurationMs: number;
  };
}

export const AFTERSIGN_SCENE_TRANSITION_FEEL: AftersignSceneTransitionFeel = {
  totalDurationMs: 540,
  reducedMotionDurationMs: 140,
  phases: [
    {
      id: "recognition-settle",
      durationMs: 180,
      delayMs: 0,
      cameraDriftPx: 4,
      cameraRollDeg: -0.35,
      vignetteAlpha: 0.1,
      bloomPulseAlpha: 0.16,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
    {
      id: "job-offer-rise",
      durationMs: 240,
      delayMs: 120,
      cameraDriftPx: 9,
      cameraRollDeg: 0.5,
      vignetteAlpha: 0.18,
      bloomPulseAlpha: 0.26,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    },
    {
      id: "route-commit",
      durationMs: 180,
      delayMs: 360,
      cameraDriftPx: 6,
      cameraRollDeg: 0.2,
      vignetteAlpha: 0.08,
      bloomPulseAlpha: 0.2,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    },
  ],
  audioCoupling: {
    recognitionSettleHz: 196,
    jobOfferRiseHz: 294,
    routeCommitHz: 392,
    gainDb: -18,
  },
  acceptance: {
    maxTotalDurationMs: 600,
    minCameraDriftPx: 8,
    maxCameraRollDeg: 0.75,
    reducedMotionMaxDurationMs: 160,
  },
};

export function getAftersignSceneTransitionPhase(
  phase: AftersignSceneTransitionPhase,
): AftersignSceneTransitionFeelPhase {
  const match = AFTERSIGN_SCENE_TRANSITION_FEEL.phases.find(
    (candidate) => candidate.id === phase,
  );

  if (!match) {
    throw new Error(`Unknown AFTERSIGN scene transition phase: ${phase}`);
  }

  return match;
}
