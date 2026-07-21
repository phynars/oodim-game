// Memory-line resolver for Io's returning-player recognition beat.
//
// SCOPE (deliberately narrow):
//   • Own the LINE TEXT variants ("sealed + listened", "opened + listened",
//     etc.) — this is authored-string data, not a feel envelope.
//   • Delegate every millisecond, meter, decibel, and easing curve to the
//     one live source of truth: `recognitionFeedbackContract` and
//     `sampleRecognitionFeedbackBeat` in
//     `apps/web/src/aftersign/recognitionFeedback.ts`.
//
// EXPLICITLY OUT OF SCOPE:
//   • No `cameraPushMs`, `cameraPushMeters`, `signGlowDelayMs`,
//     `stingDelayMs`, `screenShakePx` constants live in this file. Every
//     prior draft that hardcoded feel numbers here drifted from the live
//     implementation within one refactor. Consume the contract instead.
//   • No collision with `IoRecognitionBeatCue` / `IoRecognitionBeatState`
//     from `packages/aftersign/src/ioRecognitionBeat.ts` (that module is
//     the state-publisher). This module's types are prefixed
//     `ReturningRecognition…` to keep the vocabulary distinct.
//
// If you feel the urge to add a duration or easing here: STOP. Edit
// `recognitionFeedbackContract` in `recognitionFeedback.ts` — the renderer,
// Playwright tests, and this module will all pick up the change through
// `sampleRecognitionFeedbackBeat`.

import {
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackOptions,
  type RecognitionFeedbackSample,
  type RecognitionOutcome,
} from "../../apps/web/src/aftersign/recognitionFeedback";

export type ReturningPacketOutcome = RecognitionOutcome;

export interface ReturningRecognitionLineState {
  readonly outcome: ReturningPacketOutcome;
  /** Did the player listen to the "let me finish saving your life" route
   *  the first time? If false, Io appends the corrective coda. */
  readonly listenedToRoute: boolean;
}

export interface ReturningRecognitionLine {
  readonly line: string;
  readonly lineId: string;
  readonly outcome: ReturningPacketOutcome;
}

const LINE_ID = {
  sealedListened: "io.recognition.returning.sealed.listened.v1",
  sealedSkipped: "io.recognition.returning.sealed.skipped.v1",
  openedListened: "io.recognition.returning.opened.listened.v1",
  openedSkipped: "io.recognition.returning.opened.skipped.v1",
} as const;

const SEALED_ROOT =
  "You came back. So did the blue seal, unbroken. That gives me two facts to trust.";
const OPENED_ROOT =
  "You came back. The seal did not. I can use one of those facts.";
const SKIP_CODA = " Next time, let me finish saving your life.";

/**
 * Resolve the authored memory line Io speaks on recognition.
 *
 * This function returns TEXT ONLY. For timing/camera/glow/sting envelope,
 * call `recognitionBeatProgress` (which delegates to the live contract).
 */
export function ioRecognitionBeat(
  state: ReturningRecognitionLineState,
): ReturningRecognitionLine {
  if (state.outcome === "sealed") {
    return {
      outcome: "sealed",
      line: state.listenedToRoute ? SEALED_ROOT : `${SEALED_ROOT}${SKIP_CODA}`,
      lineId: state.listenedToRoute
        ? LINE_ID.sealedListened
        : LINE_ID.sealedSkipped,
    };
  }

  return {
    outcome: "opened",
    line: state.listenedToRoute ? OPENED_ROOT : `${OPENED_ROOT}${SKIP_CODA}`,
    lineId: state.listenedToRoute
      ? LINE_ID.openedListened
      : LINE_ID.openedSkipped,
  };
}

/**
 * Sample the recognition beat's per-ms feel envelope.
 *
 * This is a THIN DELEGATE to `sampleRecognitionFeedbackBeat` — it exists
 * only so callers in this package can read the beat without reaching
 * across into `apps/web`. It inherits reduced-motion handling, outcome
 * cue lights (lantern / packetSeal / kioskSign / rainRim / hapticScale),
 * wooden-click timing, and input-lock — none of which existed in the
 * previous local re-implementation.
 *
 * Motion INVARIANT: the envelope is fully bounded — after `totalMs`
 * (or `reducedMotionTotalMs`) the sampler returns a settled sample. No
 * perpetual oscillators; the underlying contract clamps `elapsedMs` and
 * every cue rides a `bell` / `easeOutCubic` / `easeInOutSine` envelope
 * that returns to a stable rest value by the end of the beat.
 */
export function recognitionBeatProgress(
  elapsedMs: number,
  options: RecognitionFeedbackOptions = {},
): RecognitionFeedbackSample {
  return sampleRecognitionFeedbackBeat(elapsedMs, options);
}

/**
 * Re-export the contract for callers that want the raw numbers (never
 * copy them — always read through this pointer).
 */
export { recognitionFeedbackContract };
