export const AFTERSIGN_RECOGNITION_BEAT_DURATION_MS = 920;

export type AftersignPacketOutcome = "sealed" | "opened";

export type AftersignRecognitionBeatCue = {
  readonly atMs: number;
  readonly durationMs: number;
  readonly easing: "linear" | "easeOutCubic" | "easeInOutSine";
  readonly cameraPushDegrees?: number;
  readonly cameraLiftPx?: number;
  readonly signGlowIntensity?: number;
  readonly bellGain?: number;
};

export type AftersignRecognitionBeat = {
  readonly packetOutcome: AftersignPacketOutcome;
  readonly totalDurationMs: typeof AFTERSIGN_RECOGNITION_BEAT_DURATION_MS;
  readonly cues: readonly AftersignRecognitionBeatCue[];
};

const BASE_RECOGNITION_CUES = [
  {
    atMs: 0,
    durationMs: 180,
    easing: "easeOutCubic",
    cameraPushDegrees: 2.4,
    cameraLiftPx: 6,
  },
  {
    atMs: 120,
    durationMs: 360,
    easing: "easeInOutSine",
    signGlowIntensity: 0.72,
  },
  {
    atMs: 180,
    durationMs: 90,
    easing: "linear",
    bellGain: 0.38,
  },
  {
    atMs: 540,
    durationMs: 220,
    easing: "easeOutCubic",
    cameraPushDegrees: -1.1,
    cameraLiftPx: -3,
  },
] as const satisfies readonly AftersignRecognitionBeatCue[];

const OPENED_PACKET_CUES = [
  {
    atMs: 280,
    durationMs: 260,
    easing: "easeInOutSine",
    signGlowIntensity: 0.46,
  },
  {
    atMs: 300,
    durationMs: 70,
    easing: "linear",
    bellGain: 0.22,
  },
] as const satisfies readonly AftersignRecognitionBeatCue[];

const SEALED_PACKET_CUES = [
  {
    atMs: 260,
    durationMs: 300,
    easing: "easeInOutSine",
    signGlowIntensity: 0.9,
  },
  {
    atMs: 300,
    durationMs: 80,
    easing: "linear",
    bellGain: 0.44,
  },
] as const satisfies readonly AftersignRecognitionBeatCue[];

export function createAftersignRecognitionBeat(
  packetOutcome: AftersignPacketOutcome,
): AftersignRecognitionBeat {
  const outcomeCues = packetOutcome === "sealed" ? SEALED_PACKET_CUES : OPENED_PACKET_CUES;

  return {
    packetOutcome,
    totalDurationMs: AFTERSIGN_RECOGNITION_BEAT_DURATION_MS,
    cues: [...BASE_RECOGNITION_CUES, ...outcomeCues].sort((a, b) => a.atMs - b.atMs),
  };
}
