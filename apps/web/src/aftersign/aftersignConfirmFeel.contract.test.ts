import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_CONFIRM_FEEL,
  getAftersignConfirmFeel,
  sampleAftersignConfirmFeel,
} from "./aftersignConfirmFeel";

// Contract test for the confirm-bloom visual feel envelope (ring + flash
// + caption). Sibling to `interactionConfirmFeel.test.ts` — that suite
// pins the SHARED confirm envelope (camera yaw / press scale / click
// gain / lift). This file pins the STRICTLY-VISUAL bloom overlay that
// composes on top: the ring pulse, the white-hot flash, and the rising
// caption offsets/opacities that the DOM player wires into CSS.
//
// Every expected number is derived from the live
// `AFTERSIGN_CONFIRM_FEEL` values — if a feel number moves, the test
// moves with it. That's the convention every sibling `.contract.test.ts`
// in this directory follows (see `packetOpenFeel.contract.test.ts` for
// the pattern).
//
// LANE NOTE: `apps/web/src/aftersign/vitest.config.ts` currently scopes
// the aftersign vitest lane to `harness/windowGameHarnessBoot.test.ts`
// only (issue #841 tracks widening the glob). This file follows the
// convention of ~5 other `.contract.test.ts` files in this directory
// that exist as executable design contracts — they typecheck under
// `typecheck:aftersign:apps-web` today and will flip into the running
// lane when #841 lands. A test that pins concrete ms/px is a contract
// whether or not the harness is currently running it.
describe("aftersignConfirmFeel — visual bloom envelope", () => {
  it("locks the confirm-feel spec ms/px numbers", () => {
    // These are the numbers the DOM player writes into CSS variables.
    // Pin them explicitly so a "just a tiny tweak" PR has to update this
    // test alongside the constant — no silent drift.
    expect(AFTERSIGN_CONFIRM_FEEL.durationMs).toBe(420);
    expect(AFTERSIGN_CONFIRM_FEEL.pulseMs).toBe(180);
    expect(AFTERSIGN_CONFIRM_FEEL.settleMs).toBe(240);
    expect(AFTERSIGN_CONFIRM_FEEL.liftPx).toBe(10);
    expect(AFTERSIGN_CONFIRM_FEEL.squashScaleX).toBeCloseTo(1.08, 5);
    expect(AFTERSIGN_CONFIRM_FEEL.squashScaleY).toBeCloseTo(0.92, 5);
    expect(AFTERSIGN_CONFIRM_FEEL.bloomOpacity).toBeCloseTo(0.72, 5);
    expect(AFTERSIGN_CONFIRM_FEEL.ringScaleStart).toBeCloseTo(0.82, 5);
    expect(AFTERSIGN_CONFIRM_FEEL.ringScaleEnd).toBeCloseTo(1.36, 5);
    expect(AFTERSIGN_CONFIRM_FEEL.shakePx).toBe(2);
    expect(AFTERSIGN_CONFIRM_FEEL.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  });

  it("starts the ring at ringScaleStart with zero opacity at t=0", () => {
    const sample = sampleAftersignConfirmFeel(0);
    expect(sample.elapsedMs).toBe(0);
    expect(sample.progress).toBe(0);
    expect(sample.ringScale).toBeCloseTo(AFTERSIGN_CONFIRM_FEEL.ringScaleStart, 5);
    expect(sample.ringOpacity).toBeCloseTo(0, 5);
  });

  it("crests the ring at ringInCutoff (18% of duration) at unit scale and full bloom", () => {
    // 18% of 420ms = 75.6ms. The ring reaches unit scale here and hits
    // its peak opacity (bloomOpacity = 0.72), matching the CSS keyframe.
    const cutoffMs = AFTERSIGN_CONFIRM_FEEL.durationMs * 0.18;
    const sample = sampleAftersignConfirmFeel(cutoffMs);
    expect(sample.ringScale).toBeCloseTo(1, 5);
    expect(sample.ringOpacity).toBeCloseTo(AFTERSIGN_CONFIRM_FEEL.bloomOpacity, 5);
  });

  it("blooms the ring out to ringScaleEnd at duration end with zero opacity", () => {
    const sample = sampleAftersignConfirmFeel(AFTERSIGN_CONFIRM_FEEL.durationMs);
    expect(sample.progress).toBe(1);
    expect(sample.ringScale).toBeCloseTo(AFTERSIGN_CONFIRM_FEEL.ringScaleEnd, 5);
    expect(sample.ringOpacity).toBeCloseTo(0, 5);
  });

  it("peaks the flash at 35% of pulseMs with 0.96 opacity and squash-mean scale", () => {
    // 35% of 180ms = 63ms. Peak opacity is 0.96, peak scale is the
    // geometric mean of squashScaleX * squashScaleY = sqrt(1.08 * 0.92).
    const peakMs = AFTERSIGN_CONFIRM_FEEL.pulseMs * 0.35;
    const sample = sampleAftersignConfirmFeel(peakMs);
    const expectedPeakScale = Math.sqrt(
      AFTERSIGN_CONFIRM_FEEL.squashScaleX * AFTERSIGN_CONFIRM_FEEL.squashScaleY,
    );
    expect(sample.flashScale).toBeCloseTo(expectedPeakScale, 5);
    expect(sample.flashOpacity).toBeCloseTo(0.96, 5);
  });

  it("ends the flash at pulseMs at 1.62 scale with zero opacity", () => {
    const sample = sampleAftersignConfirmFeel(AFTERSIGN_CONFIRM_FEEL.pulseMs);
    expect(sample.flashScale).toBeCloseTo(1.62, 5);
    expect(sample.flashOpacity).toBeCloseTo(0, 5);
  });

  it("rises the caption from -24px to -34px in the first 22% of duration", () => {
    // t=0: caption starts at -24px, opacity 0.
    const start = sampleAftersignConfirmFeel(0);
    expect(start.captionOffsetPx).toBeCloseTo(-24, 5);
    expect(start.captionOpacity).toBeCloseTo(0, 5);

    // t = 22% of 420ms = 92.4ms: caption at -34px, opacity 1.
    const crestMs = AFTERSIGN_CONFIRM_FEEL.durationMs * 0.22;
    const crest = sampleAftersignConfirmFeel(crestMs);
    expect(crest.captionOffsetPx).toBeCloseTo(-34, 5);
    expect(crest.captionOpacity).toBeCloseTo(1, 5);
  });

  it("drifts the caption to -44px with zero opacity by duration end", () => {
    const sample = sampleAftersignConfirmFeel(AFTERSIGN_CONFIRM_FEEL.durationMs);
    expect(sample.captionOffsetPx).toBeCloseTo(-44, 5);
    expect(sample.captionOpacity).toBeCloseTo(0, 5);
  });

  it("clamps negative elapsed time to the t=0 frame", () => {
    const sample = sampleAftersignConfirmFeel(-40);
    expect(sample.elapsedMs).toBe(0);
    expect(sample.progress).toBe(0);
    expect(sample.ringScale).toBeCloseTo(AFTERSIGN_CONFIRM_FEEL.ringScaleStart, 5);
    expect(sample.ringOpacity).toBeCloseTo(0, 5);
    expect(sample.flashOpacity).toBeCloseTo(0, 5);
    expect(sample.captionOpacity).toBeCloseTo(0, 5);
  });

  it("clamps overrun elapsed time to the duration-end frame", () => {
    const overrun = sampleAftersignConfirmFeel(AFTERSIGN_CONFIRM_FEEL.durationMs + 500);
    expect(overrun.progress).toBe(1);
    expect(overrun.ringOpacity).toBeCloseTo(0, 5);
    expect(overrun.captionOpacity).toBeCloseTo(0, 5);
  });

  it("returns a frozen spec that honors partial overrides", () => {
    const tuned = getAftersignConfirmFeel({ durationMs: 320, liftPx: 6 });
    expect(tuned.durationMs).toBe(320);
    expect(tuned.liftPx).toBe(6);
    // Unspecified fields inherit from the default spec.
    expect(tuned.pulseMs).toBe(AFTERSIGN_CONFIRM_FEEL.pulseMs);
    expect(tuned.ringScaleStart).toBe(AFTERSIGN_CONFIRM_FEEL.ringScaleStart);
    // Overrides sample through — at t = 320 (new duration end) progress = 1.
    const endOfOverride = sampleAftersignConfirmFeel(320, tuned);
    expect(endOfOverride.progress).toBe(1);
    expect(endOfOverride.ringScale).toBeCloseTo(AFTERSIGN_CONFIRM_FEEL.ringScaleEnd, 5);
  });
});
