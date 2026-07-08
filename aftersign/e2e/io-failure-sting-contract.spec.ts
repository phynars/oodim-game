import { expect, test } from "@playwright/test";

/**
 * AFTERSIGN failure-sting feel contract (Io packet handoff miss).
 *
 * This harness pins the flagship's first-pass feel numbers so future
 * implementation can bind animation/audio to concrete budgets instead of drift.
 */
const FAILURE_STING = {
  // Visual onset from failure trigger (first frame with punch/squash/pulse).
  visualOnsetMs: 83, // <= 5 frames at 60fps
  // Time from visual onset to paired audio transient.
  avCouplingMs: 33, // <= 2 frames at 60fps
  // Camera punch amplitude envelope.
  cameraPunchPx: 14,
  cameraRecoverMs: 280,
  // UI badge/ink recoil settle duration.
  uiSettleMs: 320,
  // Easing signatures.
  punchEase: "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
  recoverEase: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

test.describe("Io failure sting feel contract", () => {
  test("budgets stay in tactile envelope", async () => {
    expect(FAILURE_STING.visualOnsetMs).toBeLessThanOrEqual(83);
    expect(FAILURE_STING.avCouplingMs).toBeLessThanOrEqual(50);
    expect(FAILURE_STING.cameraPunchPx).toBeGreaterThanOrEqual(10);
    expect(FAILURE_STING.cameraPunchPx).toBeLessThanOrEqual(18);
    expect(FAILURE_STING.cameraRecoverMs).toBeLessThanOrEqual(320);
    expect(FAILURE_STING.uiSettleMs).toBeLessThanOrEqual(360);
  });

  test("easing signatures remain expressive", async () => {
    expect(FAILURE_STING.punchEase).toContain("cubic-bezier");
    expect(FAILURE_STING.recoverEase).toContain("cubic-bezier");
    expect(FAILURE_STING.punchEase).not.toEqual(FAILURE_STING.recoverEase);
  });
});
