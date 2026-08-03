import {
  chooseIoReturningSessionLine,
  ioReturningSessionLines,
} from "../../packages/aftersign/src/ioReturningSession.ts";
// SINGLE SOURCE OF TRUTH for the recognition beat's feel numbers.
//
// Per `aftersign/src/README.md`, the recognition beat's timing envelope,
// camera delta, sign glow, sting, and wooden-click delay live in ONE place:
// `apps/web/src/aftersign/recognitionFeedback.ts` — exporting
// `recognitionFeedbackContract` and `sampleRecognitionFeedbackBeat`.
//
// This module deliberately imports from that canonical source (not the
// sibling `aftersign/src/recognitionFeedback.ts` — which is a wider-shape
// harness that duplicates the same constants for the standalone e2e
// assertion runners in this folder). Routing through the canonical module
// is what keeps the flagship's build plan (below) reconcilable with the
// renderer, harness, and feel-layer samples — they all read from the same
// contract.
import {
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackSample,
  type RecognitionOutcome,
} from "../../apps/web/src/aftersign/recognitionFeedback";

// Packet outcome shape for the recognition beat's feel envelope. The wider
// four-value packet outcome (sealed | opened | withheld | returned) lives in
// `packages/aftersign/src/ioReturningSession`. The two-value outcome here is
// only what the visual/audio beat actually branches on — the lantern
// intensity, sting sample, and target camera offset.
export type PacketOutcome = "sealed" | "opened";

export interface RecognitionBeatCue {
  atMs: number;
  kind: "camera" | "light" | "audio" | "haptic" | "dialogue";
  label: string;
  value: number | string;
  easing?: "linear" | "easeOutCubic" | "easeInOutSine";
}

export interface RecognitionBeatPlan {
  outcome: PacketOutcome;
  durationMs: number;
  cues: RecognitionBeatCue[];
  line: string;
}

// Duration is pinned to the canonical feel contract's `totalMs` so the
// build plan below and the runtime feel envelope (`recognitionBeatProgress`)
// cannot disagree. A prior revision hard-coded 1640ms here while the sampler
// resolved at 1220ms — 420ms of drift between what the flagship declared it
// was scheduling and what the feel layer actually rendered. Reading the
// contract eliminates that class of drift entirely.
export const RECOGNITION_BEAT_DURATION_MS = recognitionFeedbackContract.totalMs;
export const RECOGNITION_PUSH_IN_DEGREES = recognitionFeedbackContract.cameraYawDegrees;
export const RECOGNITION_PUSH_IN_MS = recognitionFeedbackContract.cameraPeakMs;
export const RECOGNITION_LANTERN_GLOW_GAIN = recognitionFeedbackContract.glowToMultiplier;
export const RECOGNITION_STING_GAIN = recognitionFeedbackContract.stingGain;
export const RECOGNITION_VISUAL_HAPTIC_SCALE_PX = recognitionFeedbackContract.hapticPx;

// The lantern-only two-outcome return line, used by the pure-visual feel plan
// below. Sourced from the single-source-of-truth line table so paraphrasing
// the string here (or drifting from the authored copy) is impossible — the
// two shorter branch keys (`sealedPacket` / `openedPacket`) are the ones the
// non-route-attention feel beat plays over the kiosk's lantern bloom.
const bareOutcomeLine = (outcome: PacketOutcome): string =>
  outcome === "sealed"
    ? ioReturningSessionLines.sealedPacket
    : ioReturningSessionLines.openedPacket;

export function buildIoRecognitionBeat(outcome: PacketOutcome): RecognitionBeatPlan {
  const line = bareOutcomeLine(outcome);
  return {
    outcome,
    durationMs: RECOGNITION_BEAT_DURATION_MS,
    line,
    cues: [
      {
        atMs: 0,
        kind: "camera",
        label: "over-shoulder push-in",
        value: RECOGNITION_PUSH_IN_DEGREES,
        easing: "easeOutCubic",
      },
      {
        atMs: recognitionFeedbackContract.glowStartMs,
        kind: "light",
        label: "Io kiosk lantern memory bloom",
        value: RECOGNITION_LANTERN_GLOW_GAIN,
        easing: "easeInOutSine",
      },
      {
        atMs: recognitionFeedbackContract.stingStartMs,
        kind: "audio",
        label: outcome === "sealed" ? "two-note bell trust sting" : "single cracked-bell recognition sting",
        value: RECOGNITION_STING_GAIN,
        easing: "linear",
      },
      {
        atMs: recognitionFeedbackContract.stingStartMs,
        kind: "haptic",
        label: "visual-only micro-screen pulse for touch devices",
        value: RECOGNITION_VISUAL_HAPTIC_SCALE_PX,
        easing: "easeOutCubic",
      },
      {
        atMs: recognitionFeedbackContract.dialogueStartMs,
        kind: "dialogue",
        label: "Io remembered return line",
        value: line,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public line-resolver API — consumed by the aftersign e2e lane
// (`io-returning-recognition-line-contract.spec.ts` and
// `recognition-beat-contract.spec.ts`).
//
// This is the four-branch mapping from saved packet outcome + route-attention
// state into Io's returning-session line. The line strings are NOT authored
// here: they come from `chooseIoReturningSessionLine` in
// `packages/aftersign/src/ioReturningSession.ts` — the single documented
// source for Io's return copy. Duplicating strings here would silently drift
// from the vertical-slice script; the wrapper below is copy-free by
// construction.
// ---------------------------------------------------------------------------

export type RouteAttention = "listened" | "skipped";

export type IoRecognitionLineId =
  | "io.recognition.returning.sealed.listened.v1"
  | "io.recognition.returning.sealed.skipped.v1"
  | "io.recognition.returning.opened.listened.v1"
  | "io.recognition.returning.opened.skipped.v1";

export interface IoRecognitionBeatInput {
  outcome: PacketOutcome;
  listenedToRoute: boolean;
}

export interface IoRecognitionBeatLine {
  outcome: PacketOutcome;
  listenedToRoute: boolean;
  routeAttention: RouteAttention;
  lineId: IoRecognitionLineId;
  line: string;
}

function lineIdFor(outcome: PacketOutcome, listened: boolean): IoRecognitionLineId {
  if (outcome === "sealed" && listened) return "io.recognition.returning.sealed.listened.v1";
  if (outcome === "sealed") return "io.recognition.returning.sealed.skipped.v1";
  if (listened) return "io.recognition.returning.opened.listened.v1";
  return "io.recognition.returning.opened.skipped.v1";
}

/**
 * Resolve the returning-player recognition line for one of Io's four saved
 * outcome × route-attention branches. Line text is delegated to
 * `chooseIoReturningSessionLine` so paraphrasing is impossible; this
 * function's only job is to pin the four `lineId`s that the renderer /
 * flagship script address the line by.
 */
export function ioRecognitionBeat(input: IoRecognitionBeatInput): IoRecognitionBeatLine {
  const routeAttention: RouteAttention = input.listenedToRoute ? "listened" : "skipped";
  const line = chooseIoReturningSessionLine({
    packetOutcome: input.outcome,
    routeAttention,
  });
  return {
    outcome: input.outcome,
    listenedToRoute: input.listenedToRoute,
    routeAttention,
    lineId: lineIdFor(input.outcome, input.listenedToRoute),
    line,
  };
}

// ---------------------------------------------------------------------------
// Public feel-envelope API — thin delegate to the CANONICAL pure-data
// `sampleRecognitionFeedbackBeat` in
// `apps/web/src/aftersign/recognitionFeedback.ts`. Kept as a separately-
// named entry point so the contract spec has a stable symbol to import and
// so future feel-envelope callers don't need to reach into the underlying
// sampler's option surface directly.
// ---------------------------------------------------------------------------

export interface RecognitionBeatProgressOptions {
  outcome?: PacketOutcome;
  reducedMotion?: boolean;
}

export function recognitionBeatProgress(
  elapsedMs: number,
  options: RecognitionBeatProgressOptions = {},
): RecognitionFeedbackSample {
  const outcome: RecognitionOutcome = options.outcome ?? "sealed";
  return sampleRecognitionFeedbackBeat(elapsedMs, {
    outcome,
    reducedMotion: options.reducedMotion ?? false,
  });
}
