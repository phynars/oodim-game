const INERT_RECOGNITION_DOM_FEEDBACK = Object.freeze({
  active: false,
  signGlowPx: 0,
  sealGlowPx: 0,
  rainRimAlpha: 0,
  hapticScale: 1,
  warmth: 0,
});

/**
 * Produces the synchronous inert recognition baseline used after save reload.
 * The caller owns its runtime variables and DOM bindings; recognition feedback
 * amplitudes are intentionally not an input and therefore remain untouched.
 */
export function resetRecognitionAfterReload({ clearDomFeedback, clearFeelCueVars }) {
  clearDomFeedback();
  clearFeelCueVars();

  return {
    memoryRecognitionBeatStartedAt: null,
    pendingRecognitionArm: false,
    lastImpactBurstChirpAt: null,
    impactBurstParticles: [],
    framesDuringRecognitionBeat: 0,
    recognitionDomFeedback: { ...INERT_RECOGNITION_DOM_FEEDBACK },
    recognitionBeatReport: null,
    recognitionSnippetFeelCue: null,
  };
}
