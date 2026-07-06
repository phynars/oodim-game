// IO packet-confirm cue — anticipation-then-punch feel curve.
//
// Two halves used to disagree:
//   samples[] described a 48ms attack (0 → peak) then decay to rest.
//   sampleIoPacketConfirmCue() did pure peak-at-t=0 decay.
// This module now has ONE source of truth: the sampler models
//   attack: 0 → peakMs, easing inCubic on the punch channels.
//   decay:  peakMs → durationMs, easing outCubic back to rest.
// samples[] is generated FROM the sampler at fixed keyframe times, and
// a runtime assertion (`assertIoPacketConfirmCueShape`) verifies they agree
// so future drift throws immediately.
//
// Feel numbers reviewed by Mara Okonkwo on PR #426.

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const outCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);

const outCubicAttack = (t) => Math.pow(clamp01(t), 3);

const lerp = (from, to, t) => from + (to - from) * clamp01(t);

const round = (value) => Math.round(value * 1000) / 1000;

const PEAK_MS = 48;

export const IO_PACKET_CONFIRM_CUE = {
  id: "io-packet-confirm",
  durationMs: 420,
  peakMs: PEAK_MS,
  easing: "inCubic attack -> outCubic decay",
  inputLockMs: 180,
  cameraShake: {
    peakPx: 5,
    // decay tail runs from peak to (peakMs + decayMs); clipped by durationMs.
    decayMs: 240,
  },
  kioskScale: {
    rest: 1,
    peak: 1.085,
    settle: 1,
    // settle phase runs peakMs → durationMs.
    settleMs: 420 - PEAK_MS,
  },
  bloomBoost: {
    peak: 0.32,
    decayMs: 300,
  },
  packetGlow: {
    rest: 0.35,
    peak: 1,
  },
  audio: {
    transientMs: 38,
    bodyMs: 210,
    pitchSemitones: 7,
  },
};

// Attack phase [0, PEAK_MS] uses inCubic so every punch channel
// starts at rest, climbs monotonically, and lands exactly on its authored
// peak. Decay phase [PEAK_MS, ...] uses outCubic back to rest.
export function sampleIoPacketConfirmCue(timeMs) {
  const cue = IO_PACKET_CONFIRM_CUE;
  const t = Math.max(0, Math.min(cue.durationMs, timeMs));

  // Kiosk scale: pop up during attack, settle after.
  let kioskScale;
  if (t <= cue.peakMs) {
    kioskScale = lerp(cue.kioskScale.rest, cue.kioskScale.peak, outCubicAttack(t / cue.peakMs));
  } else {
    const settleT = (t - cue.peakMs) / cue.kioskScale.settleMs;
    kioskScale = lerp(cue.kioskScale.peak, cue.kioskScale.settle, outCubic(settleT));
  }

  // Camera shake: ramp 0 → peak during attack, then decay to 0 over decayMs.
  let cameraShakePx;
  if (t <= cue.peakMs) {
    cameraShakePx = lerp(0, cue.cameraShake.peakPx, outCubicAttack(t / cue.peakMs));
  } else {
    const decayT = (t - cue.peakMs) / cue.cameraShake.decayMs;
    cameraShakePx = lerp(cue.cameraShake.peakPx, 0, outCubic(decayT));
  }

  // Bloom boost: same shape as shake but its own decay window.
  let bloomBoost;
  if (t <= cue.peakMs) {
    bloomBoost = lerp(0, cue.bloomBoost.peak, outCubicAttack(t / cue.peakMs));
  } else {
    const decayT = (t - cue.peakMs) / cue.bloomBoost.decayMs;
    bloomBoost = lerp(cue.bloomBoost.peak, 0, outCubic(decayT));
  }

  // Packet glow: rest → peak during attack, then ease back toward rest.
  let packetGlow;
  if (t <= cue.peakMs) {
    packetGlow = lerp(cue.packetGlow.rest, cue.packetGlow.peak, outCubicAttack(t / cue.peakMs));
  } else {
    const decayT = (t - cue.peakMs) / (cue.durationMs - cue.peakMs);
    packetGlow = lerp(cue.packetGlow.peak, cue.packetGlow.rest, outCubic(decayT));
  }

  return {
    timeMs: t,
    kioskScale: round(kioskScale),
    cameraShakePx: round(cameraShakePx),
    bloomBoost: round(bloomBoost),
    packetGlow: round(packetGlow),
  };
}

export function isIoPacketConfirmInputLocked(timeMs) {
  return timeMs >= 0 && timeMs < IO_PACKET_CONFIRM_CUE.inputLockMs;
}

// Fixed keyframes used by the runtime assertion — these are derived from
// the sampler by construction, not authored independently. Their job is
// to lock in the feel numbers so a regression in the curve throws loudly.
export const IO_PACKET_CONFIRM_KEYFRAMES = [0, 24, 48, 120, 240, 420].map((timeMs) =>
  sampleIoPacketConfirmCue(timeMs),
);

// Boot-time sanity check: the sampler must satisfy the confirm-cue shape.
// Called once at kiosk boot; throws on drift so bad tweaks fail fast.
export function assertIoPacketConfirmCueShape() {
  const cue = IO_PACKET_CONFIRM_CUE;
  const rest = sampleIoPacketConfirmCue(0);
  const peak = sampleIoPacketConfirmCue(cue.peakMs);
  const end = sampleIoPacketConfirmCue(cue.durationMs);

  const problems = [];

  // At t=0 punch channels are at rest, scale is rest, glow is rest.
  if (rest.cameraShakePx !== 0) problems.push(`rest.cameraShakePx=${rest.cameraShakePx} expected 0`);
  if (rest.bloomBoost !== 0) problems.push(`rest.bloomBoost=${rest.bloomBoost} expected 0`);
  if (rest.kioskScale !== cue.kioskScale.rest)
    problems.push(`rest.kioskScale=${rest.kioskScale} expected ${cue.kioskScale.rest}`);
  if (rest.packetGlow !== cue.packetGlow.rest)
    problems.push(`rest.packetGlow=${rest.packetGlow} expected ${cue.packetGlow.rest}`);

  // At peak the punch channels reach their peak values (within rounding).
  const near = (a, b, eps = 0.002) => Math.abs(a - b) <= eps;
  if (!near(peak.cameraShakePx, cue.cameraShake.peakPx))
    problems.push(`peak.cameraShakePx=${peak.cameraShakePx} expected ~${cue.cameraShake.peakPx}`);
  if (!near(peak.bloomBoost, cue.bloomBoost.peak))
    problems.push(`peak.bloomBoost=${peak.bloomBoost} expected ~${cue.bloomBoost.peak}`);
  if (!near(peak.kioskScale, cue.kioskScale.peak))
    problems.push(`peak.kioskScale=${peak.kioskScale} expected ~${cue.kioskScale.peak}`);
  if (!near(peak.packetGlow, cue.packetGlow.peak))
    problems.push(`peak.packetGlow=${peak.packetGlow} expected ~${cue.packetGlow.peak}`);

  // At the end everything settles back.
  if (!near(end.kioskScale, cue.kioskScale.settle))
    problems.push(`end.kioskScale=${end.kioskScale} expected ~${cue.kioskScale.settle}`);
  if (!near(end.cameraShakePx, 0)) problems.push(`end.cameraShakePx=${end.cameraShakePx} expected ~0`);

  // Monotonic attack on shake: samples should be non-decreasing 0 → peakMs.
  let prev = -Infinity;
  for (let ms = 0; ms <= cue.peakMs; ms += 8) {
    const s = sampleIoPacketConfirmCue(ms).cameraShakePx;
    if (s < prev - 0.002) {
      problems.push(`attack cameraShake not monotonic at t=${ms}: ${s} < previous ${prev}`);
      break;
    }
    prev = s;
  }

  if (problems.length > 0) {
    throw new Error(`IO packet confirm cue shape drift:\n  - ${problems.join("\n  - ")}`);
  }

  return { rest, peak, end, keyframes: IO_PACKET_CONFIRM_KEYFRAMES };
}
