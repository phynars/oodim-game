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
  AftersignOrraAction,
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

export type AftersignOrraRecognitionFeel = {
  label: "orra-recognition";
  durationMs: 720;
  haloPulsePx: 6;
  cameraKneelDeg: 2.4;
  memoryThreadGlowAlpha: 0.82;
  chapelHumDuckDb: -2;
  audioCue: "orra-recognition-bell";
};

export type AftersignOrraMemoryBeat = {
  kind: "orra-recognition";
  scene: "orra-return";
  recognizesPlayer: boolean;
  orraAction: AftersignOrraAction | null;
  recognitionFeel: AftersignOrraRecognitionFeel | null;
};

export type AftersignOrraRecognitionBeatCue = {
  kind: "orra-recognition-beat";
  orraAction: AftersignOrraAction;
  startedAtMs: number;
};

export type AftersignOrraRecognitionEnvelope = {
  label: "orra-recognition";
  elapsedMs: number;
  saintHaloPulsePx: number;
  cameraKneelDeg: number;
  memoryThreadGlowAlpha: number;
  chapelHumDuckDb: number;
  audioCue: "orra-recognition-bell" | null;
};

export type AftersignOrraRecognitionBeatOpen = {
  readonly cue: AftersignOrraRecognitionBeatCue;
};

/**
 * Re-export of the frozen live contract.
 */
export const AFTERSIGN_IO_RECOGNITION_FEEL: AftersignIoRecognitionFeel =
  IO_RETURNING_RECOGNITION_FEEL;

export const AFTERSIGN_ORRA_RECOGNITION_FEEL: AftersignOrraRecognitionFeel = {
  label: "orra-recognition",
  durationMs: 720,
  haloPulsePx: 6,
  cameraKneelDeg: 2.4,
  memoryThreadGlowAlpha: 0.82,
  chapelHumDuckDb: -2,
  audioCue: "orra-recognition-bell",
};

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

export function sampleAftersignOrraMemoryBeat(
  state: AftersignVerticalSliceState,
): AftersignOrraMemoryBeat {
  return {
    kind: "orra-recognition",
    scene: "orra-return",
    recognizesPlayer: state.orraRecognizesPlayer,
    orraAction: state.orraAction,
    recognitionFeel: state.orraRecognizesPlayer ? AFTERSIGN_ORRA_RECOGNITION_FEEL : null,
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

export function openAftersignOrraRecognitionBeat(
  state: AftersignVerticalSliceState,
  startedAtMs: number,
): AftersignOrraRecognitionBeatOpen {
  if (!state.orraRecognizesPlayer) {
    throw new Error(
      "Cannot open Orra recognition beat: Orra does not recognize the player yet",
    );
  }
  if (state.orraAction !== "answered-saint-orra") {
    throw new Error(
      "Cannot open Orra recognition beat: Orra action is not committed",
    );
  }
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) {
    throw new Error(
      "Cannot open Orra recognition beat: startedAtMs must be a non-negative finite number",
    );
  }

  return {
    cue: {
      kind: "orra-recognition-beat",
      orraAction: state.orraAction,
      startedAtMs,
    },
  };
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

export function sampleAftersignOrraRecognitionEnvelope(
  cue: AftersignOrraRecognitionBeatCue,
  nowMs: number,
  options: { reducedMotion?: boolean } = {},
): AftersignOrraRecognitionEnvelope {
  if (!Number.isFinite(nowMs)) {
    throw new Error("sampleAftersignOrraRecognitionEnvelope: nowMs must be finite");
  }

  const elapsedMs = Math.max(0, nowMs - cue.startedAtMs);
  const progress = clamp01(elapsedMs / AFTERSIGN_ORRA_RECOGNITION_FEEL.durationMs);
  const eased = easeOutCubic(progress);
  const pulse = Math.sin(progress * Math.PI);

  return {
    label: "orra-recognition",
    elapsedMs,
    saintHaloPulsePx: options.reducedMotion
      ? 0
      : round2(AFTERSIGN_ORRA_RECOGNITION_FEEL.haloPulsePx * pulse),
    cameraKneelDeg: options.reducedMotion
      ? 0
      : round2(AFTERSIGN_ORRA_RECOGNITION_FEEL.cameraKneelDeg * eased),
    memoryThreadGlowAlpha: AFTERSIGN_ORRA_RECOGNITION_FEEL.memoryThreadGlowAlpha,
    chapelHumDuckDb: AFTERSIGN_ORRA_RECOGNITION_FEEL.chapelHumDuckDb,
    audioCue: elapsedMs <= 180 ? AFTERSIGN_ORRA_RECOGNITION_FEEL.audioCue : null,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
