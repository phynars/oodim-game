import {
  IO_RETURNING_RECOGNITION_FEEL,
  type IoReturningRecognitionFeel,
} from "../../../../aftersign/src/ioReturningRecognitionFeel";
import {
  createIoRecognitionBeatState,
  playIoRecognitionBeat,
  type IoRecognitionBeatCue,
  type IoRecognitionBeatState,
} from "../../../../packages/aftersign/src/ioRecognitionBeat";
import {
  sampleRecognitionFeedbackBeat,
  type RecognitionFeedbackSample,
} from "./recognitionFeedback";
import type {
  AftersignPacketOutcome,
  AftersignSceneId,
  AftersignVerticalSliceState,
} from "./verticalSliceRuntimeState";

/**
 * Type alias for the frozen recognition-feel contract. Kept as an alias
 * (not a redefinition) so this module cannot drift from the live source.
 */
export type AftersignIoRecognitionFeel = IoReturningRecognitionFeel;

export type AftersignIoMemoryBeat = {
  scene: AftersignSceneId;
  recognizesPlayer: boolean;
  packetOutcome: AftersignPacketOutcome | null;
  recognitionFeel: AftersignIoRecognitionFeel | null;
};

/**
 * Re-export of the frozen live contract.
 */
export const AFTERSIGN_IO_RECOGNITION_FEEL: AftersignIoRecognitionFeel =
  IO_RETURNING_RECOGNITION_FEEL;

export function sampleAftersignIoMemoryBeat(
  state: AftersignVerticalSliceState,
): AftersignIoMemoryBeat {
  return {
    scene: state.scene,
    recognizesPlayer: state.ioRecognizesPlayer,
    packetOutcome: state.packetOutcome,
    recognitionFeel: state.ioRecognizesPlayer ? AFTERSIGN_IO_RECOGNITION_FEEL : null,
  };
}

export type AftersignIoRecognitionBeatOpen = {
  readonly cueState: IoRecognitionBeatState;
  readonly cue: IoRecognitionBeatCue;
};

export function openAftersignIoRecognitionBeat(
  state: AftersignVerticalSliceState,
  startedAtMs: number,
): AftersignIoRecognitionBeatOpen {
  if (!state.ioRecognizesPlayer) {
    throw new Error(
      "Cannot open Io recognition beat: Io does not recognize the player yet",
    );
  }
  if (state.packetOutcome !== "sealed" && state.packetOutcome !== "opened") {
    throw new Error(
      "Cannot open Io recognition beat: packetOutcome is not committed",
    );
  }
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
    throw new Error(
      "Cannot open Io recognition beat: startedAtMs must be a non-negative finite number",
    );
  }

  const cueState = createIoRecognitionBeatState();
  const cue = playIoRecognitionBeat(cueState, state.packetOutcome, startedAtMs);
  return { cueState, cue };
}

export function sampleAftersignIoRecognitionEnvelope(
  cue: IoRecognitionBeatCue,
  nowMs: number,
  options: { reducedMotion?: boolean; lineId?: string } = {},
): RecognitionFeedbackSample {
  if (!Number.isFinite(nowMs)) {
    throw new Error("sampleAftersignIoRecognitionEnvelope: nowMs must be finite");
  }

  const elapsedMs = Math.max(0, nowMs - cue.startedAtMs);
  return sampleRecognitionFeedbackBeat(elapsedMs, {
    outcome: cue.packetOutcome,
    startedAt: cue.startedAtMs,
    reducedMotion: options.reducedMotion,
    lineId: options.lineId,
  });
}
