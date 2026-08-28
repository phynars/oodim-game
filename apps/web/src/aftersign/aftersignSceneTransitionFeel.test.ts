import { describe, expect, it } from "vitest";
import {
  AFTERSIGN_SCENE_TRANSITION_FEEL,
  getAftersignSceneTransitionPhase,
} from "./aftersignSceneTransitionFeel";

describe("AFTERSIGN_SCENE_TRANSITION_FEEL", () => {
  it("keeps the full transition playable instead of ornamental", () => {
    expect(AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs).toBeLessThanOrEqual(
      AFTERSIGN_SCENE_TRANSITION_FEEL.acceptance.maxTotalDurationMs,
    );
    expect(AFTERSIGN_SCENE_TRANSITION_FEEL.reducedMotionDurationMs).toBeLessThanOrEqual(
      AFTERSIGN_SCENE_TRANSITION_FEEL.acceptance.reducedMotionMaxDurationMs,
    );
  });

  it("pins the camera drift and roll within mobile-safe feel numbers", () => {
    const maxDriftPx = Math.max(
      ...AFTERSIGN_SCENE_TRANSITION_FEEL.phases.map((phase) => phase.cameraDriftPx),
    );
    const maxRollDeg = Math.max(
      ...AFTERSIGN_SCENE_TRANSITION_FEEL.phases.map((phase) => Math.abs(phase.cameraRollDeg)),
    );

    expect(maxDriftPx).toBeGreaterThanOrEqual(
      AFTERSIGN_SCENE_TRANSITION_FEEL.acceptance.minCameraDriftPx,
    );
    expect(maxRollDeg).toBeLessThanOrEqual(
      AFTERSIGN_SCENE_TRANSITION_FEEL.acceptance.maxCameraRollDeg,
    );
  });

  it("couples recognition, offer, and route commitment to rising tones", () => {
    expect(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.recognitionSettleHz).toBeLessThan(
      AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.jobOfferRiseHz,
    );
    expect(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.jobOfferRiseHz).toBeLessThan(
      AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.routeCommitHz,
    );
    expect(AFTERSIGN_SCENE_TRANSITION_FEEL.audioCoupling.gainDb).toBeLessThanOrEqual(-12);
  });

  it("resolves each named phase for runtime consumers", () => {
    expect(getAftersignSceneTransitionPhase("recognition-settle").durationMs).toBe(180);
    expect(getAftersignSceneTransitionPhase("job-offer-rise").cameraDriftPx).toBe(9);
    expect(getAftersignSceneTransitionPhase("route-commit").delayMs).toBe(360);
  });
});
