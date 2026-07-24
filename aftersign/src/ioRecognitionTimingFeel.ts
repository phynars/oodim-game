export type IoRecognitionTimingFeel = {
  /** Fixed simulation step in milliseconds. 60Hz: 16.67ms. */
  frameMs: number;
  /** Delay after the returning-session line begins before the camera starts its push-in. */
  cameraPushDelayMs: number;
  /** Duration of the recognition push-in. Kept short so control theft stays under the player-feel ceiling. */
  cameraPushDurationMs: number;
  /** Delay before the recognition sting starts. */
  stingDelayMs: number;
  /** Delay before the sign glow reaches readable intensity. */
  signGlowDelayMs: number;
  /** Largest allowed gap between the first visible acknowledgement and first audible acknowledgement. */
  maxAudioVisualGapMs: number;
};

export type IoRecognitionFeedbackSample = {
  elapsedMs: number;
  cameraPush: number;
  stingStarted: boolean;
  signGlow: number;
};

export const DEFAULT_IO_RECOGNITION_TIMING_FEEL: IoRecognitionTimingFeel = {
  frameMs: 1000 / 60,
  cameraPushDelayMs: 50,
  cameraPushDurationMs: 360,
  stingDelayMs: 100,
  signGlowDelayMs: 83,
  maxAudioVisualGapMs: 50,
};

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smooth01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function sampleIoRecognitionFeedback(
  elapsedMs: number,
  feel: IoRecognitionTimingFeel = DEFAULT_IO_RECOGNITION_TIMING_FEEL,
): IoRecognitionFeedbackSample {
  const cameraT =
    (elapsedMs - feel.cameraPushDelayMs) / Math.max(1, feel.cameraPushDurationMs);
  const glowT = (elapsedMs - feel.signGlowDelayMs) / Math.max(1, feel.frameMs * 8);

  return {
    elapsedMs,
    cameraPush: smooth01(cameraT),
    stingStarted: elapsedMs >= feel.stingDelayMs,
    signGlow: smooth01(glowT),
  };
}

export function checkIoRecognitionTimingFeel(
  feel: IoRecognitionTimingFeel = DEFAULT_IO_RECOGNITION_TIMING_FEEL,
): void {
  const firstFrame = sampleIoRecognitionFeedback(feel.frameMs, feel);
  if (firstFrame.cameraPush !== 0 || firstFrame.signGlow !== 0 || firstFrame.stingStarted) {
    throw new Error("Io recognition feedback must not fire on frame 1; it should read as authored, not accidental.");
  }

  const firstVisualMs = Math.min(feel.cameraPushDelayMs, feel.signGlowDelayMs);
  if (firstVisualMs > feel.frameMs * 6) {
    throw new Error("Io recognition must acknowledge the returned player within six frames.");
  }

  const audioVisualGapMs = Math.abs(feel.stingDelayMs - firstVisualMs);
  if (audioVisualGapMs > feel.maxAudioVisualGapMs) {
    throw new Error(
      `Io recognition audio/visual gap ${audioVisualGapMs.toFixed(2)}ms exceeds ${feel.maxAudioVisualGapMs}ms.`,
    );
  }

  const midBeat = sampleIoRecognitionFeedback(feel.cameraPushDelayMs + feel.cameraPushDurationMs / 2, feel);
  if (midBeat.cameraPush <= 0.35 || midBeat.cameraPush >= 0.65) {
    throw new Error("Io recognition camera push should ease through the midpoint without snapping.");
  }

  const finalBeat = sampleIoRecognitionFeedback(
    feel.cameraPushDelayMs + feel.cameraPushDurationMs + feel.frameMs,
    feel,
  );
  if (finalBeat.cameraPush !== 1) {
    throw new Error("Io recognition camera push must settle before control returns.");
  }
  if (!finalBeat.stingStarted || finalBeat.signGlow < 0.95) {
    throw new Error("Io recognition must finish with sound and sign glow resolved.");
  }

  if (feel.cameraPushDurationMs > 420) {
    throw new Error("Io recognition control theft must stay under 420ms.");
  }
}

export function runIoRecognitionTimingFeelChecks(): void {
  checkIoRecognitionTimingFeel();
}
