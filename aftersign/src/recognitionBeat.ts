// Memory-line resolver for Io's returning-player recognition beat.
//
// SCOPE (deliberately narrow):
//   • Own the LINE-KEY mapping for the returning-session recognition
//     beat: given a packet outcome × route-attention pair, return the
//     canonical authored line.
//   • Delegate every millisecond, meter, decibel, and easing curve to
//     the one live source of truth: `recognitionFeedbackContract` and
//     `sampleRecognitionFeedbackBeat` in
//     `apps/web/src/aftersign/recognitionFeedback.ts`.
//   • Delegate every string of dialogue to `chooseIoReturningSessionLine`
//     in `packages/aftersign/src/ioReturningSession.ts`. That module
//     owns the pinned line text (`sealedPacket`, `openedPacket`,
//     `sealedPacketListenedRoute`, `sealedPacketSkippedRoute`,
//     `openedPacketListenedRoute`, `openedPacketSkippedRoute`, etc.);
//     the shared harness asserts those strings verbatim. Never fork,
//     paraphrase, or splice them here.
//
// EXPLICITLY OUT OF SCOPE:
//   • No `cameraPushMs`, `cameraPushMeters`, `signGlowDelayMs`,
//     `stingDelayMs`, `screenShakePx` constants live in this file. Every
//     prior draft that hardcoded feel numbers here drifted from the live
//     implementation within one refactor. Consume the contract instead.
//   • No literal line strings live in this file. If a variant is
//     missing, add it to `ioReturningSessionLines` in the package —
//     do not compose it locally by concatenating a coda onto a root.
//   • No collision with `IoRecognitionBeatCue` / `IoRecognitionBeatState`
//     from `packages/aftersign/src/ioRecognitionBeat.ts` (that module is
//     the state-publisher). This module's types are prefixed
//     `ReturningRecognition…` to keep the vocabulary distinct.
//
// If you feel the urge to add a duration, easing, or line string here:
// STOP. Edit `recognitionFeedbackContract` in `recognitionFeedback.ts`
// or `ioReturningSessionLines` in `ioReturningSession.ts` — the
// renderer, Playwright tests, and this module will all pick up the
// change through their respective resolvers.

import {
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackOptions,
  type RecognitionFeedbackSample,
  type RecognitionOutcome,
} from "../../apps/web/src/aftersign/recognitionFeedback";
import {
  chooseIoReturningSessionLine,
  type IoRouteAttention,
} from "../../packages/aftersign/src/ioReturningSession";

export type ReturningPacketOutcome = RecognitionOutcome;

export interface ReturningRecognitionLineState {
  readonly outcome: ReturningPacketOutcome;
  /** Did the player listen to the "let me finish saving your life" route
   *  the first time? Maps to the canonical `routeAttention` axis in
   *  `ioReturningSessionLines`: `true → 'listened'`, `false → 'skipped'`. */
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

/**
 * Resolve the authored memory line Io speaks on recognition.
 *
 * This function returns TEXT ONLY, sourced verbatim from
 * `chooseIoReturningSessionLine` — the canonical resolver that owns the
 * pinned line strings. For timing/camera/glow/sting envelope, call
 * `recognitionBeatProgress` (which delegates to the live contract).
 */
export function ioRecognitionBeat(
  state: ReturningRecognitionLineState,
): ReturningRecognitionLine {
  const routeAttention: IoRouteAttention = state.listenedToRoute
    ? "listened"
    : "skipped";

  const line = chooseIoReturningSessionLine({
    packetOutcome: state.outcome,
    routeAttention,
  });

  if (state.outcome === "sealed") {
    return {
      outcome: "sealed",
      line,
      lineId: state.listenedToRoute
        ? LINE_ID.sealedListened
        : LINE_ID.sealedSkipped,
    };
  }

  return {
    outcome: "opened",
    line,
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
