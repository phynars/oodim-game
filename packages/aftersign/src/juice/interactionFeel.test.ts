import { describe, expect, it } from "vitest";

import {
  getCueEndMs,
  getTrackMotionMs,
  PACKET_CONFIRM_FEEL,
  selectInteractionFeelCues,
  type InteractionFeelCue,
} from "./interactionFeel.ts";

// HARNESS-ONLY suite. See the banner in `./interactionFeel.ts` — this
// module has no runtime consumer yet; the live confirm feel lives in
// `../interactionConfirm.ts`. This suite exists so the spec isn't a dead
// literal: it exercises the selector + acceptance invariants so a bad
// edit to the feel numbers or a broken reduced-motion track FAILS CI
// before a consumer picks the module up.

describe("PACKET_CONFIRM_FEEL (harness-only juice spec)", () => {
  it("respects its own acceptance.maxMotionMs across the motion-safe track", () => {
    const total = getTrackMotionMs(PACKET_CONFIRM_FEEL.motionSafe);
    expect(total).toBeLessThanOrEqual(PACKET_CONFIRM_FEEL.acceptance.maxMotionMs);
  });

  it("caps horizontal shake below acceptance.maxShakeXPx", () => {
    for (const cue of PACKET_CONFIRM_FEEL.motionSafe) {
      const shake = cue.shakeXPx ?? 0;
      expect(shake).toBeLessThanOrEqual(PACKET_CONFIRM_FEEL.acceptance.maxShakeXPx);
    }
  });

  it("gives every cue a non-zero duration and a defined easing", () => {
    const allCues: readonly InteractionFeelCue[] = [
      ...PACKET_CONFIRM_FEEL.motionSafe,
      ...PACKET_CONFIRM_FEEL.reducedMotion,
    ];
    for (const cue of allCues) {
      expect(cue.durationMs).toBeGreaterThan(0);
      expect(cue.easing).toBeTruthy();
      expect(getCueEndMs(cue)).toBeGreaterThan(0);
    }
  });

  it("keeps cue ids unique within each track (so a renderer can key on id)", () => {
    for (const track of [
      PACKET_CONFIRM_FEEL.motionSafe,
      PACKET_CONFIRM_FEEL.reducedMotion,
    ]) {
      const ids = track.map((cue) => cue.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps audio cues coupled tight enough for the acceptance window", () => {
    // Every cue that carries audio must fit inside the audio-coupling
    // budget from spec start — otherwise the click/thud would land after
    // the visual and feel detached.
    const budget = PACKET_CONFIRM_FEEL.acceptance.requiresAudioCouplingWithinMs;
    const audioCues = PACKET_CONFIRM_FEEL.motionSafe.filter(
      (cue) => cue.audioGainDb !== undefined,
    );
    expect(audioCues.length).toBeGreaterThan(0);
    for (const cue of audioCues) {
      // The audio hit fires at cue start (delayMs); it must land within
      // the coupling budget of the spec's timeline origin.
      expect(cue.delayMs ?? 0).toBeLessThanOrEqual(budget);
    }
  });
});

describe("selectInteractionFeelCues", () => {
  it("returns the motion-safe track when reducedMotion is false", () => {
    const cues = selectInteractionFeelCues(PACKET_CONFIRM_FEEL, false);
    expect(cues).toBe(PACKET_CONFIRM_FEEL.motionSafe);
  });

  it("returns the reduced-motion track when reducedMotion is true", () => {
    const cues = selectInteractionFeelCues(PACKET_CONFIRM_FEEL, true);
    expect(cues).toBe(PACKET_CONFIRM_FEEL.reducedMotion);
  });

  it("guarantees the reduced-motion track carries no shake", () => {
    // Non-negotiable a11y invariant: prefers-reduced-motion users must
    // never receive shakeX / shakeY. If a future edit slips shake into
    // the reduced-motion track, this fails and blocks merge.
    const cues = selectInteractionFeelCues(PACKET_CONFIRM_FEEL, true);
    for (const cue of cues) {
      expect(cue.shakeXPx ?? 0).toBe(0);
      expect(cue.shakeYDeg ?? 0).toBe(0);
    }
  });

  it("guarantees the reduced-motion track uses no vertical translate", () => {
    const cues = selectInteractionFeelCues(PACKET_CONFIRM_FEEL, true);
    for (const cue of cues) {
      expect(cue.translateYPx ?? 0).toBe(0);
    }
  });
});

describe("getTrackMotionMs", () => {
  it("returns 0 for an empty track", () => {
    expect(getTrackMotionMs([])).toBe(0);
  });

  it("takes the max end-timestamp, not the sum (cues can overlap in time)", () => {
    const cues: InteractionFeelCue[] = [
      { id: "a", durationMs: 100, easing: "linear" },
      { id: "b", delayMs: 50, durationMs: 80, easing: "linear" }, // ends at 130
      { id: "c", delayMs: 10, durationMs: 40, easing: "linear" }, // ends at 50
    ];
    expect(getTrackMotionMs(cues)).toBe(130);
  });
});
