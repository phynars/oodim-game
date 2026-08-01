export type RecognitionBeatCue =
  | "arrival-breath"
  | "name-catch"
  | "memory-glint"
  | "reply-ready";

export interface RecognitionBeatFrame {
  readonly cue: RecognitionBeatCue;
  readonly startMs: number;
  readonly durationMs: number;
  readonly cameraDollyCm: number;
  readonly cameraYawDeg: number;
  readonly vignetteOpacity: number;
  readonly bloomBoost: number;
  readonly audioGainDb: number;
  readonly easing: "linear" | "easeOutCubic" | "easeInOutSine" | "springSoft";
}

export interface RecognitionBeatContract {
  readonly totalMs: number;
  readonly maxCameraDollyCm: number;
  readonly maxCameraYawDeg: number;
  readonly frames: readonly RecognitionBeatFrame[];
}

export const IO_RECOGNITION_BEAT: RecognitionBeatContract = {
  totalMs: 1180,
  maxCameraDollyCm: 18,
  maxCameraYawDeg: 4.5,
  frames: [
    {
      cue: "arrival-breath",
      startMs: 0,
      durationMs: 220,
      cameraDollyCm: 6,
      cameraYawDeg: 0,
      vignetteOpacity: 0.08,
      bloomBoost: 0.04,
      audioGainDb: -10,
      easing: "easeOutCubic",
    },
    {
      cue: "name-catch",
      startMs: 220,
      durationMs: 260,
      cameraDollyCm: 12,
      cameraYawDeg: 1.5,
      vignetteOpacity: 0.12,
      bloomBoost: 0.08,
      audioGainDb: -6,
      easing: "springSoft",
    },
    {
      cue: "memory-glint",
      startMs: 480,
      durationMs: 340,
      cameraDollyCm: 18,
      cameraYawDeg: 4.5,
      vignetteOpacity: 0.18,
      bloomBoost: 0.18,
      audioGainDb: -3,
      easing: "easeInOutSine",
    },
    {
      cue: "reply-ready",
      startMs: 820,
      durationMs: 360,
      cameraDollyCm: 10,
      cameraYawDeg: 0,
      vignetteOpacity: 0.06,
      bloomBoost: 0.06,
      audioGainDb: 0,
      easing: "easeOutCubic",
    },
  ],
} as const;

export function recognitionBeatAt(ms: number): RecognitionBeatFrame | null {
  if (!Number.isFinite(ms) || ms < 0 || ms >= IO_RECOGNITION_BEAT.totalMs) {
    return null;
  }

  return (
    IO_RECOGNITION_BEAT.frames.find(
      (frame) => ms >= frame.startMs && ms < frame.startMs + frame.durationMs,
    ) ?? null
  );
}

export function assertRecognitionBeatContract(
  contract: RecognitionBeatContract = IO_RECOGNITION_BEAT,
): void {
  if (contract.totalMs !== 1180) {
    throw new Error(`recognition beat must last 1180ms, got ${contract.totalMs}ms`);
  }

  if (contract.maxCameraDollyCm > 18) {
    throw new Error(`recognition beat dolly must stay <=18cm, got ${contract.maxCameraDollyCm}cm`);
  }

  if (contract.maxCameraYawDeg > 4.5) {
    throw new Error(`recognition beat yaw must stay <=4.5deg, got ${contract.maxCameraYawDeg}deg`);
  }

  let cursorMs = 0;
  for (const frame of contract.frames) {
    if (frame.startMs !== cursorMs) {
      throw new Error(`recognition beat cue ${frame.cue} starts at ${frame.startMs}ms, expected ${cursorMs}ms`);
    }

    if (frame.durationMs < 180 || frame.durationMs > 420) {
      throw new Error(`recognition beat cue ${frame.cue} duration must be 180-420ms, got ${frame.durationMs}ms`);
    }

    if (Math.abs(frame.cameraDollyCm) > contract.maxCameraDollyCm) {
      throw new Error(`recognition beat cue ${frame.cue} exceeds dolly cap`);
    }

    if (Math.abs(frame.cameraYawDeg) > contract.maxCameraYawDeg) {
      throw new Error(`recognition beat cue ${frame.cue} exceeds yaw cap`);
    }

    if (frame.vignetteOpacity < 0 || frame.vignetteOpacity > 0.2) {
      throw new Error(`recognition beat cue ${frame.cue} vignette must stay within 0..0.2`);
    }

    if (frame.bloomBoost < 0 || frame.bloomBoost > 0.2) {
      throw new Error(`recognition beat cue ${frame.cue} bloom boost must stay within 0..0.2`);
    }

    if (frame.audioGainDb < -12 || frame.audioGainDb > 0) {
      throw new Error(`recognition beat cue ${frame.cue} audio gain must stay within -12..0dB`);
    }

    cursorMs += frame.durationMs;
  }

  if (cursorMs !== contract.totalMs) {
    throw new Error(`recognition beat frames cover ${cursorMs}ms, expected ${contract.totalMs}ms`);
  }
}
