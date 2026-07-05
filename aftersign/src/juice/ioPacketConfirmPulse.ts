export type IoPacketConfirmSample = {
  timeMs: number;
  kioskScale: number;
  cameraShakePx: number;
  bloomBoost: number;
  packetGlow: number;
};

export type IoPacketConfirmCue = {
  id: "io-packet-confirm";
  durationMs: number;
  easing: "outBack(1.55) -> outCubic";
  inputLockMs: number;
  cameraShake: {
    peakPx: number;
    decayMs: number;
  };
  kioskScale: {
    peak: number;
    settle: number;
  };
  bloomBoost: {
    peak: number;
    decayMs: number;
  };
  audio: {
    transientMs: number;
    bodyMs: number;
    pitchSemitones: number;
  };
  samples: IoPacketConfirmSample[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const outCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

const outBack = (t: number, overshoot = 1.55): number => {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
};

const lerp = (from: number, to: number, t: number): number =>
  from + (to - from) * clamp01(t);

const round = (value: number): number => Math.round(value * 1000) / 1000;

export const IO_PACKET_CONFIRM_CUE: IoPacketConfirmCue = {
  id: "io-packet-confirm",
  durationMs: 420,
  easing: "outBack(1.55) -> outCubic",
  inputLockMs: 180,
  cameraShake: {
    peakPx: 5,
    decayMs: 240,
  },
  kioskScale: {
    peak: 1.085,
    settle: 1,
  },
  bloomBoost: {
    peak: 0.32,
    decayMs: 300,
  },
  audio: {
    transientMs: 38,
    bodyMs: 210,
    pitchSemitones: 7,
  },
  samples: [
    { timeMs: 0, kioskScale: 1, cameraShakePx: 0, bloomBoost: 0, packetGlow: 0.35 },
    { timeMs: 48, kioskScale: 1.085, cameraShakePx: 5, bloomBoost: 0.32, packetGlow: 1 },
    { timeMs: 120, kioskScale: 1.032, cameraShakePx: 2.5, bloomBoost: 0.21, packetGlow: 0.78 },
    { timeMs: 240, kioskScale: 1.008, cameraShakePx: 0, bloomBoost: 0.07, packetGlow: 0.52 },
    { timeMs: 420, kioskScale: 1, cameraShakePx: 0, bloomBoost: 0, packetGlow: 0.35 },
  ],
};

export function sampleIoPacketConfirmCue(timeMs: number): IoPacketConfirmSample {
  const clampedTime = Math.max(0, Math.min(IO_PACKET_CONFIRM_CUE.durationMs, timeMs));
  const popT = clampedTime / 90;
  const settleT = Math.max(0, clampedTime - 90) / 330;
  const scale = clampedTime <= 90
    ? lerp(1, IO_PACKET_CONFIRM_CUE.kioskScale.peak, outBack(popT))
    : lerp(IO_PACKET_CONFIRM_CUE.kioskScale.peak, IO_PACKET_CONFIRM_CUE.kioskScale.settle, outCubic(settleT));
  const shakeT = clampedTime / IO_PACKET_CONFIRM_CUE.cameraShake.decayMs;
  const bloomT = clampedTime / IO_PACKET_CONFIRM_CUE.bloomBoost.decayMs;
  const glowT = clampedTime / IO_PACKET_CONFIRM_CUE.durationMs;

  return {
    timeMs: clampedTime,
    kioskScale: round(scale),
    cameraShakePx: round(IO_PACKET_CONFIRM_CUE.cameraShake.peakPx * (1 - outCubic(shakeT))),
    bloomBoost: round(IO_PACKET_CONFIRM_CUE.bloomBoost.peak * (1 - outCubic(bloomT))),
    packetGlow: round(lerp(1, 0.35, outCubic(glowT))),
  };
}

export function isIoPacketConfirmInputLocked(timeMs: number): boolean {
  return timeMs >= 0 && timeMs < IO_PACKET_CONFIRM_CUE.inputLockMs;
}
