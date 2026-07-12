export const IO_RETURNING_RECOGNITION_FEEL = Object.freeze({
  beat: "io_returning_recognition",
  subtitleLeadMs: 120,
  cameraDollyMs: 720,
  cameraDollyZ: -0.42,
  cameraYawDeg: 2.5,
  phonePulseDelayMs: 180,
  phonePulseMs: 360,
  phonePulseScale: 1.08,
  memoryLineDelayMs: 520,
  voiceSoftAttackMs: 45,
  voiceReleaseMs: 140,
  screenVignetteAlpha: 0.18,
  easing: {
    camera: "cubic-bezier(.2,.8,.2,1)",
    phonePulse: "cubic-bezier(.34,1.56,.64,1)",
    vignette: "ease-out",
  },
});

export function getIoReturningRecognitionFeel(reducedMotion = false) {
  if (!reducedMotion) {
    return IO_RETURNING_RECOGNITION_FEEL;
  }

  return Object.freeze({
    ...IO_RETURNING_RECOGNITION_FEEL,
    cameraDollyMs: 0,
    cameraDollyZ: 0,
    cameraYawDeg: 0,
    phonePulseScale: 1,
    screenVignetteAlpha: 0.12,
  });
}

export function assertIoReturningRecognitionFeel(feel) {
  const failures = [];

  if (feel.subtitleLeadMs !== 120) {
    failures.push("Io recognition subtitle must lead by exactly 120ms");
  }

  if (feel.cameraDollyMs > 720) {
    failures.push("Io recognition camera dolly must complete within 720ms");
  }

  if (Math.abs(feel.cameraDollyZ) > 0.42) {
    failures.push("Io recognition camera dolly must stay within 0.42 world units");
  }

  if (Math.abs(feel.cameraYawDeg) > 2.5) {
    failures.push("Io recognition camera yaw must stay within 2.5deg");
  }

  if (feel.phonePulseDelayMs !== 180 || feel.phonePulseMs !== 360) {
    failures.push("Io phone pulse must start at 180ms and last exactly 360ms");
  }

  if (feel.memoryLineDelayMs !== 520) {
    failures.push("Io memory line must surface at exactly 520ms");
  }

  if (feel.voiceSoftAttackMs > 45 || feel.voiceReleaseMs > 140) {
    failures.push("Io voice envelope must stay inside 45ms attack / 140ms release");
  }

  if (feel.screenVignetteAlpha > 0.18) {
    failures.push("Io recognition vignette alpha must not exceed 0.18");
  }

  return failures;
}
