// Contract test for AFTERSIGN_SCENE_TRANSITION_FEEL — pins the
// concrete ms/px/dB/Hz numbers so a drift breaks CI. The sibling
// `.consumer.test.ts` proves the numbers actually reach a mounted DOM
// layer on the served surface; this file locks the shape they must
// take before that mount happens.

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

  it("keeps phase delays + durations consistent with totalDurationMs", () => {
    // The route-commit phase starts at delayMs=360 and runs 180ms →
    // ends at 540ms, which must equal totalDurationMs. This is the
    // internal-coherence check that turned out fine on review —
    // pinning it here so a future edit can't silently drift.
    const routeCommit = getAftersignSceneTransitionPhase("route-commit");
    expect(routeCommit.delayMs + routeCommit.durationMs).toBe(
      AFTERSIGN_SCENE_TRANSITION_FEEL.totalDurationMs,
    );
  });
});
