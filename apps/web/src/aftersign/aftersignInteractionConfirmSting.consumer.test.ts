// Consumer test for the interaction-confirm STING wiring.
//
// The sibling `aftersignInteractionConfirmSting.contract.test.ts` pins the
// pure numbers (peak-at-35%, chirp sweep, clamp boundaries). This test
// proves the sting is actually WIRED — that `AFTERSIGN_INTERACTION_CONFIRM_STING`
// and `sampleAftersignInteractionConfirmSting` reach the shipped confirm
// layer whenever a packet-confirm interaction fires.
//
// The consumer is `playAftersignPacketConfirmInteractionFeel`, which every
// commit-tap flows through via `resolveAndPlayAftersignPacketConfirmInteraction`.
// It stamps the sting contract onto the `.aftersign-confirm-feel` layer as
// `data-sting-*` attributes so the served renderer can plumb them into
// WebAudio without re-importing the module. Same idiom the
// `feltRecognitionBeat` lane uses to hand audio cues to its renderer.
//
// Scope guard:
//   - does NOT touch the sting spec numbers — the contract test pins those.
//   - does NOT touch the bloom CSS vars — `aftersignConfirmFeel.consumer.test.ts`
//     pins those.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTERSIGN_INTERACTION_CONFIRM_STING,
  sampleAftersignInteractionConfirmSting,
} from "./aftersignInteractionConfirmSting";
import { resolveAndPlayAftersignPacketConfirmInteraction } from "./verticalSlicePacketInteraction";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

const LAYER_SELECTOR = ".aftersign-confirm-feel";

function committedState(
  packetOutcome: "opened" | "sealed",
): AftersignVerticalSliceState {
  return { packetOutcome } as AftersignVerticalSliceState;
}

function currentLayer(): HTMLElement {
  const layer = document.body.querySelector(LAYER_SELECTOR) as HTMLElement | null;
  if (!layer) throw new Error("expected a .aftersign-confirm-feel layer to be mounted");
  return layer;
}

describe("aftersignInteractionConfirmSting consumer (packet-confirm wiring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("stamps the sting spec contract on the confirm layer for a commit", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(committedState("opened"), "commit", {
      x: 100,
      y: 200,
    });

    const layer = currentLayer();
    const spec = AFTERSIGN_INTERACTION_CONFIRM_STING;

    expect(layer.dataset.stingDurationMs).toBe(String(spec.durationMs));
    expect(layer.dataset.stingChirpDurationMs).toBe(String(spec.chirpDurationMs));
    expect(layer.dataset.stingChirpStartHz).toBe(String(spec.chirpStartHz));
    expect(layer.dataset.stingChirpEndHz).toBe(String(spec.chirpEndHz));
    expect(layer.dataset.stingBloomPopScale).toBe(String(spec.bloomPopScale));
    expect(layer.dataset.stingSettlePx).toBe(String(spec.settlePx));
    expect(layer.dataset.stingEasing).toBe(spec.easing);
  });

  it("stamps the sampler's peak (at 35% of durationMs) so the renderer can drive audio without re-sampling", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(committedState("sealed"), "commit", {
      x: 40,
      y: 60,
    });

    const layer = currentLayer();
    const spec = AFTERSIGN_INTERACTION_CONFIRM_STING;
    const peak = sampleAftersignInteractionConfirmSting(spec.durationMs * 0.35);

    expect(Number(layer.dataset.stingPeakBloomScale)).toBeCloseTo(peak.bloomScale, 5);
    expect(Number(layer.dataset.stingPeakChirpHz)).toBeCloseTo(peak.chirpHz, 5);
    expect(Number(layer.dataset.stingPeakChirpGain)).toBeCloseTo(peak.chirpGain, 5);
    // The bloom-pop peak must equal the spec's headline number — this is
    // the single value the ear + eye are aligned on ("pop at 1.08").
    expect(Number(layer.dataset.stingPeakBloomScale)).toBeCloseTo(spec.bloomPopScale, 5);
  });

  it("also stamps the sting for the inspect action (every commit-flow tap reads the sting)", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(committedState("opened"), "inspect", {
      x: 12,
      y: 24,
    });

    const layer = currentLayer();
    // The sting is a property of the confirm SURFACE, not of the outcome —
    // inspecting still needs the audio-visual chirp. Absence here would
    // mean an inspect tap ships silent.
    expect(layer.dataset.stingDurationMs).toBe(
      String(AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs),
    );
  });

  it("zeros the chirp gain and marks the layer reduced-motion when reducedMotion is set", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(committedState("opened"), "commit", {
      reducedMotion: true,
    });

    const layer = currentLayer();
    expect(layer.dataset.stingReducedMotion).toBe("true");
    expect(layer.dataset.stingPeakChirpGain).toBe("0");
    // Frequency start / end are informational — the ear still hears the
    // pitch anchor even at zero gain (a screen reader may key off it).
    // Regressing to an undefined dataset here would mean the sting was
    // never stamped under reducedMotion, not that it was correctly muted.
    expect(layer.dataset.stingChirpStartHz).toBe(
      String(AFTERSIGN_INTERACTION_CONFIRM_STING.chirpStartHz),
    );
  });
});
