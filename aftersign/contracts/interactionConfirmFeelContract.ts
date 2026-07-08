export interface InteractionConfirmFeelContract {
  /** Ack must be perceptible on the very next rendered frame after input edge. */
  visibleByFrameDeltaMax: number;
  /** Full ack envelope duration. */
  totalDurationMsMax: number;
  /** Scale pulse values and timing. */
  scalePulse: {
    from: number;
    peak: number;
    backTo: number;
    durationMs: number;
    easing: "easeOutQuad";
  };
  /** White overlay flash to mimic haptic presence on touch screens. */
  tintFlash: {
    whiteOverlayAlpha: number;
    durationMs: number;
  };
  /** Short tonal cue for confirm feedback. */
  audioBlip: {
    waveform: "sine";
    frequencyHz: number;
    durationMs: number;
  };
  /** Performance guardrail on mid-tier mobile during ack. */
  perf: {
    droppedFramesAllowed: number;
  };
}

/**
 * Team-agreed flagship interaction-confirm feel target (Diego lane, 2026-07-08 scrum).
 */
export const INTERACTION_CONFIRM_FEEL_CONTRACT: InteractionConfirmFeelContract = {
  visibleByFrameDeltaMax: 1,
  totalDurationMsMax: 90,
  scalePulse: {
    from: 1.0,
    peak: 1.06,
    backTo: 1.0,
    durationMs: 80,
    easing: "easeOutQuad",
  },
  tintFlash: {
    whiteOverlayAlpha: 0.04,
    durationMs: 40,
  },
  audioBlip: {
    waveform: "sine",
    frequencyHz: 120,
    durationMs: 80,
  },
  perf: {
    droppedFramesAllowed: 0,
  },
};

export interface InteractionConfirmSample {
  frameDeltaToFirstVisual: number;
  durationMs: number;
  scaleFrom: number;
  scalePeak: number;
  scaleBackTo: number;
  scaleDurationMs: number;
  scaleEasing: string;
  tintAlpha: number;
  tintDurationMs: number;
  audioWaveform: string;
  audioFrequencyHz: number;
  audioDurationMs: number;
  droppedFrames: number;
}

export function validateInteractionConfirmSample(
  sample: InteractionConfirmSample,
  contract: InteractionConfirmFeelContract = INTERACTION_CONFIRM_FEEL_CONTRACT,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  if (sample.frameDeltaToFirstVisual > contract.visibleByFrameDeltaMax) {
    failures.push(
      `visual ack came after ${sample.frameDeltaToFirstVisual} frames (max ${contract.visibleByFrameDeltaMax})`,
    );
  }

  if (sample.durationMs > contract.totalDurationMsMax) {
    failures.push(
      `ack duration ${sample.durationMs}ms exceeds ${contract.totalDurationMsMax}ms`,
    );
  }

  if (
    sample.scaleFrom !== contract.scalePulse.from ||
    sample.scalePeak !== contract.scalePulse.peak ||
    sample.scaleBackTo !== contract.scalePulse.backTo ||
    sample.scaleDurationMs !== contract.scalePulse.durationMs ||
    sample.scaleEasing !== contract.scalePulse.easing
  ) {
    failures.push("scale pulse does not match contract (1.0→1.06→1.0, 80ms, easeOutQuad)");
  }

  if (
    sample.tintAlpha !== contract.tintFlash.whiteOverlayAlpha ||
    sample.tintDurationMs !== contract.tintFlash.durationMs
  ) {
    failures.push("tint flash does not match contract (alpha 0.04, 40ms)");
  }

  if (
    sample.audioWaveform !== contract.audioBlip.waveform ||
    sample.audioFrequencyHz !== contract.audioBlip.frequencyHz ||
    sample.audioDurationMs !== contract.audioBlip.durationMs
  ) {
    failures.push("audio blip does not match contract (sine, 120Hz, 80ms)");
  }

  if (sample.droppedFrames > contract.perf.droppedFramesAllowed) {
    failures.push(
      `dropped ${sample.droppedFrames} frame(s) during ack (allowed ${contract.perf.droppedFramesAllowed})`,
    );
  }

  return { ok: failures.length === 0, failures };
}
