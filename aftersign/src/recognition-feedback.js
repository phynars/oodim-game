// Pure recognition-beat feedback model. Callers own all I/O: this module
// takes explicit timestamps + a feedback classification and returns data.
// There is NO DOM access, NO audio call, NO story/runtime reach-in here —
// those boundaries are the whole point of lifting this out of main.js.
//
// Served DOM/animation stays in `aftersign/recognition-feedback.js`
// (`playRecognitionFeedback`); this file is the headless model that unit
// tests + any future renderer wires can share.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const RECOGNITION_FEEDBACK_DEFAULTS = Object.freeze({
  durationMs: 1180,
  earlyWindowMs: 180,
  lateWindowMs: 180,
  hitWindowMs: 80,
});

/**
 * Classify an input timestamp against a recognition beat window.
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
export const computeRecognitionFeedbackState = ({
  timing,
  elapsedMs = 0,
  durationMs = RECOGNITION_FEEDBACK_DEFAULTS.durationMs,
}) => {
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
 * Trigger a cue through the caller-provided audio boundary. Returns true if
 * the audio dependency was invoked. The caller — not this module — owns the
 * `_runtime.audio.lastCue` slot (shipped specs assert specific cue tokens
 * there: `packet-confirmed`, `io-return-action`, etc.). A caller that wires
 * this helper into the served audio pipeline MUST publish authored cues to
 * that slot, not the raw `recognition-<state>` string.
 * @param {{ play?: (cue: string, feedback: ReturnType<typeof computeRecognitionFeedbackState>) => unknown }} audio
 * @param {ReturnType<typeof computeRecognitionFeedbackState>} feedback
 */
export const triggerRecognitionAudioCue = (audio, feedback) => {
  if (!audio || typeof audio.play !== "function") return false;
  audio.play(feedback.cue, feedback);
  return true;
};

/**
 * Return DOM metadata derived from a feedback state. The caller applies it
 * to real DOM; this helper never touches `document`.
 * @param {ReturnType<typeof computeRecognitionFeedbackState>} feedback
 */
export const recognitionDomFeedbackMetadata = (feedback) => ({
  feedback: feedback.state,
  active: String(feedback.acknowledged),
  progress: String(feedback.normalized),
  cue: feedback.cue,
});
