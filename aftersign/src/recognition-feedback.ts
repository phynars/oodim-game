// Pure recognition-beat feedback model. Callers own all I/O: this module
// takes explicit timestamps + a feedback classification and returns data.
// There is NO DOM access, NO audio call, NO story/runtime reach-in here —
// those boundaries are the whole point of lifting this out of main.js.
//
// Served DOM/animation stays in `aftersign/recognition-feedback.js`
// (`playRecognitionFeedback`); this file is the headless model that
// future renderer wires + the pure-runner contract share.
//
// `.ts` not `.js`: Soren's AI008 note in `aftersign/pure-runner.ts`
// (packet-choice intent block) records that an earlier `.js` leaf
// tripped TS7016 in `typecheck:aftersign` because this tsconfig has
// no `allowJs`. Every leaf a pure-runner `.test.ts` imports must be
// `.ts`-extensioned, or the blocking gate reds.

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const RECOGNITION_FEEDBACK_DEFAULTS = Object.freeze({
  durationMs: 1180,
  earlyWindowMs: 180,
  lateWindowMs: 180,
  hitWindowMs: 80,
});

export type RecognitionTiming = "hit" | "miss" | "early" | "late";

export type RecognitionBeatDetection = {
  active: boolean;
  elapsedMs: number;
  offsetMs: number;
  timing: RecognitionTiming;
};

export type RecognitionBeatInput = {
  beatStartedAtMs: number;
  inputAtMs: number;
  durationMs?: number;
  earlyWindowMs?: number;
  lateWindowMs?: number;
  hitWindowMs?: number;
};

/**
 * Classify an input timestamp against a recognition beat window. The
 * window opens at `beatStartedAtMs` and closes `durationMs` later; a hit
 * lies within `hitWindowMs` of the center, early/late extend to
 * `earlyWindowMs` / `lateWindowMs` on either side, everything else
 * (including inputs outside the active span) is a miss.
 */
export const detectRecognitionBeat = (
  input: RecognitionBeatInput,
): RecognitionBeatDetection => {
  const config = { ...RECOGNITION_FEEDBACK_DEFAULTS, ...input };
  const elapsedMs = config.inputAtMs - config.beatStartedAtMs;
  const offsetMs = elapsedMs - config.durationMs / 2;
  const absoluteOffsetMs = Math.abs(offsetMs);
  const active = elapsedMs >= 0 && elapsedMs <= config.durationMs;
  const timing: RecognitionTiming = !active
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

export type RecognitionFeedbackState = {
  state: RecognitionTiming;
  normalized: number;
  acknowledged: boolean;
  cue: `recognition-${RecognitionTiming}`;
};

/**
 * Derive the presentation state. No story, movement, or persistence
 * access. `normalized` is `elapsedMs / durationMs` clamped to `[0, 1]`
 * so a renderer can drive a progress bar without re-clamping; `cue` is
 * a derivable token the caller may route through its audio pipeline.
 */
export const computeRecognitionFeedbackState = ({
  timing,
  elapsedMs = 0,
  durationMs = RECOGNITION_FEEDBACK_DEFAULTS.durationMs,
}: {
  timing: RecognitionTiming;
  elapsedMs?: number;
  durationMs?: number;
}): RecognitionFeedbackState => {
  const normalized = clamp(elapsedMs / durationMs, 0, 1);
  const state: RecognitionTiming =
    timing === "hit"
      ? "hit"
      : timing === "early"
        ? "early"
        : timing === "late"
          ? "late"
          : "miss";
  return {
    state,
    normalized,
    acknowledged: state !== "miss",
    cue: `recognition-${state}` as const,
  };
};

export type RecognitionAudioHandle = {
  play?: (cue: string, feedback: RecognitionFeedbackState) => unknown;
};

/**
 * Trigger a cue through the caller-provided audio boundary. Returns
 * `true` if the audio dependency was invoked.
 *
 * The caller — not this module — owns the `_runtime.audio.lastCue`
 * slot. Shipped specs assert specific authored tokens there
 * (`packet-confirmed`, `io-return-action`, etc.;
 * `aftersign/e2e/io-phone-ready-look-sound-contract.spec.ts:91`
 * compares that slot to an authored cue). A caller that wires this
 * helper into the served audio pipeline MUST publish the authored cue
 * to that slot, NOT the raw `recognition-<state>` string this module
 * produces for internal routing. Overwriting the shared slot with
 * `recognition-hit` would red the sibling contract spec.
 *
 * A missing or malformed audio handle returns `false` quietly — the
 * caller decides whether that is a deliberate test no-op or a logged
 * misconfiguration. The module itself never throws from a render tick.
 */
export const triggerRecognitionAudioCue = (
  audio: RecognitionAudioHandle | null | undefined,
  feedback: RecognitionFeedbackState,
): boolean => {
  if (!audio || typeof audio.play !== "function") return false;
  audio.play(feedback.cue, feedback);
  return true;
};

export type RecognitionDomFeedbackMetadata = {
  feedback: RecognitionTiming;
  active: string;
  progress: string;
  cue: string;
};

/**
 * Return DOM metadata derived from a feedback state. The caller applies
 * it to real DOM via `setAttribute`; this helper never touches
 * `document`. Boolean and numeric fields are pre-stringified so the
 * caller doesn't re-serialize at the render tick.
 */
export const recognitionDomFeedbackMetadata = (
  feedback: RecognitionFeedbackState,
): RecognitionDomFeedbackMetadata => ({
  feedback: feedback.state,
  active: String(feedback.acknowledged),
  progress: String(feedback.normalized),
  cue: feedback.cue,
});
