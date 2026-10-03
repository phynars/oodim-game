// Pure recognition-beat feedback model. Runtime callers own state and DOM;
// this module only computes feedback and invokes dependencies explicitly.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const RECOGNITION_FEEDBACK_DEFAULTS = Object.freeze({
  durationMs: 1180,
  earlyWindowMs: 180,
  lateWindowMs: 180,
  hitWindowMs: 80,
});

/**
 * Validate an input timestamp against a recognition beat.
 * @param {{ beatStartedAtMs: number, inputAtMs: number, durationMs?: number, earlyWindowMs?: number, lateWindowMs?: number, hitWindowMs?: number }} input
 */
export const detectRecognitionBeat = (input) => {
  const config = { ...RECOGNITION_FEEDBACK_DEFAULTS, ...input };
  const elapsedMs = config.inputAtMs - config.beatStartedAtMs;
  const offsetMs = elapsedMs - config.durationMs / 2;
  const absoluteOffsetMs = Math.abs(offsetMs);
  const active = elapsedMs >= 0 && elapsedMs <= config.durationMs;
  const timing = !active
    ? "miss"
    : absoluteOffsetMs <= config.hitWindowMs
      ? "hit"
      : offsetMs < 0 && absoluteOffsetMs <= config.earlyWindowMs
        ? "early"
        : offsetMs > 0 && absoluteOffsetMs <= config.lateWindowMs
          ? "late"
          : "miss";
  return { active, elapsedMs, offsetMs, timing };
};

/**
 * Derive the presentation state. No story, movement, or persistence access.
 * @param {{ timing: "hit"|"miss"|"early"|"late", elapsedMs?: number, durationMs?: number }} timing
 */
export const computeRecognitionFeedbackState = ({ timing, elapsedMs = 0, durationMs = RECOGNITION_FEEDBACK_DEFAULTS.durationMs }) => {
  const normalized = clamp(elapsedMs / durationMs, 0, 1);
  const state = timing === "hit" ? "hit" : timing === "early" ? "early" : timing === "late" ? "late" : "miss";
  return {
    state,
    normalized,
    acknowledged: state !== "miss",
    cue: `recognition-${state}`,
  };
};

/**
 * Trigger a cue through the caller-provided audio boundary.
 * @param {{ play?: (cue: string, feedback: ReturnType<typeof computeRecognitionFeedbackState>) => unknown }} audio
 * @param {ReturnType<typeof computeRecognitionFeedbackState>} feedback
 */
export const triggerRecognitionAudioCue = (audio, feedback) => {
  if (!audio || typeof audio.play !== "function") return false;
  audio.play(feedback.cue, feedback);
  return true;
};

/**
 * Return DOM metadata. The caller is responsible for applying it.
 * @param {ReturnType<typeof computeRecognitionFeedbackState>} feedback
 */
export const recognitionDomFeedbackMetadata = (feedback) => ({
  feedback: feedback.state,
  active: String(feedback.acknowledged),
  progress: String(feedback.normalized),
  cue: feedback.cue,
});

/**
 * Compatibility entry point for the existing served recognition cue.
 * It keeps DOM animation dependency-injected and never reaches story state.
 */
export const playRecognitionFeedback = (element, { reducedMotion = false } = {}) => {
  if (!element || typeof element.animate !== "function") return false;
  try {
    element.animate(
      reducedMotion
        ? [{ opacity: 1 }, { opacity: 0.82 }, { opacity: 1 }]
        : [{ transform: "translateY(0)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }],
      { duration: 180, easing: "ease-out" },
    );
    return true;
  } catch {
    return false;
  }
};
