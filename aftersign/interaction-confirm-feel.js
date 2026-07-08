const CONFIRM_FEEL_MS = 220;
const FRAME_MS_60FPS = 1000 / 60;

const CONFIRM_FEEL_PROFILE = Object.freeze({
  totalMs: CONFIRM_FEEL_MS,
  pressDipMs: 46,
  snapPeakMs: 92,
  settleMs: CONFIRM_FEEL_MS,
  minScale: 0.94,
  peakScale: 1.035,
  finalScale: 1,
  liftPx: -2.5,
  cameraImpulsePx: 3.5,
  cameraImpulseMs: 160,
  ringMaxOpacity: 0.72,
  ringStartRadiusPx: 7,
  ringEndRadiusPx: 24,
  bloomPeak: 0.42,
  bloomMs: 150,
  audio: Object.freeze({
    clickMs: 0,
    chimeMs: 34,
    clickGain: 0.18,
    chimeGain: 0.11,
    chimePitchHz: 740,
  }),
});

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function easeOutCubic(t) {
  const p = 1 - clamp01(t);
  return 1 - p * p * p;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

function triangularPulse(t) {
  const p = clamp01(t);
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

function isMonotonicNonIncreasing(values, tolerance = 0.0001) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[i - 1] + tolerance) {
      return false;
    }
  }
  return true;
}

function isMonotonicNonDecreasing(values, tolerance = 0.0001) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] + tolerance < values[i - 1]) {
      return false;
    }
  }
  return true;
}

function sampleInteractionConfirm(tMs, profile = CONFIRM_FEEL_PROFILE) {
  const t = Math.max(0, Math.min(profile.totalMs, tMs));
  const pressT = clamp01(t / profile.pressDipMs);
  const snapT = clamp01((t - profile.pressDipMs) / (profile.snapPeakMs - profile.pressDipMs));
  const settleT = clamp01((t - profile.snapPeakMs) / (profile.settleMs - profile.snapPeakMs));
  const ringT = clamp01(t / profile.totalMs);
  const shakeT = clamp01(t / profile.cameraImpulseMs);
  const bloomT = clamp01(t / profile.bloomMs);

  let scale;
  if (t <= profile.pressDipMs) {
    scale = lerp(profile.finalScale, profile.minScale, easeInOutSine(pressT));
  } else if (t <= profile.snapPeakMs) {
    scale = lerp(profile.minScale, profile.peakScale, easeOutCubic(snapT));
  } else {
    scale = lerp(profile.peakScale, profile.finalScale, easeOutCubic(settleT));
  }

  const shakeEnvelope = 1 - easeOutCubic(shakeT);
  const shakeDirection = Math.sin(t * 0.19) >= 0 ? 1 : -1;

  return Object.freeze({
    tMs: t,
    scale,
    yPx: lerp(0, profile.liftPx, triangularPulse(t / profile.totalMs)),
    cameraShakePx: profile.cameraImpulsePx * shakeEnvelope * shakeDirection,
    ringOpacity: profile.ringMaxOpacity * (1 - easeOutCubic(ringT)),
    ringRadiusPx: lerp(profile.ringStartRadiusPx, profile.ringEndRadiusPx, easeOutCubic(ringT)),
    bloom: profile.bloomPeak * triangularPulse(bloomT),
    audio: Object.freeze({
      click: t === profile.audio.clickMs,
      chime: t >= profile.audio.chimeMs && t < profile.audio.chimeMs + FRAME_MS_60FPS,
      clickGain: profile.audio.clickGain,
      chimeGain: profile.audio.chimeGain,
      chimePitchHz: profile.audio.chimePitchHz,
    }),
  });
}

function makeInteractionConfirmTimeline(stepMs = FRAME_MS_60FPS, profile = CONFIRM_FEEL_PROFILE) {
  const samples = [];
  for (let t = 0; t < profile.totalMs; t += stepMs) {
    samples.push(sampleInteractionConfirm(t, profile));
  }
  samples.push(sampleInteractionConfirm(profile.totalMs, profile));
  return samples;
}

function validateInteractionConfirmFeel(profile = CONFIRM_FEEL_PROFILE) {
  const start = sampleInteractionConfirm(0, profile);
  const press = sampleInteractionConfirm(profile.pressDipMs, profile);
  const peak = sampleInteractionConfirm(profile.snapPeakMs, profile);
  const end = sampleInteractionConfirm(profile.totalMs, profile);
  const timeline = makeInteractionConfirmTimeline(FRAME_MS_60FPS, profile);

  const shakeAbs = timeline.map((sample) => Math.abs(sample.cameraShakePx));
  const ringOpacityTimeline = timeline.map((sample) => sample.ringOpacity);
  const ringRadiusTimeline = timeline.map((sample) => sample.ringRadiusPx);

  return Object.freeze({
    totalDurationMatches: profile.totalMs === CONFIRM_FEEL_MS,
    pressDipHitsTarget: Math.abs(press.scale - profile.minScale) < 0.001,
    snapPeakHitsTarget: Math.abs(peak.scale - profile.peakScale) < 0.001,
    settlesToOne: Math.abs(end.scale - profile.finalScale) < 0.001,
    shakeStartsAtImpulse: Math.abs(Math.abs(start.cameraShakePx) - profile.cameraImpulsePx) < 0.001,
    shakeSettles: Math.abs(end.cameraShakePx) < 0.001,
    shakeEnvelopeMonotonic: isMonotonicNonIncreasing(shakeAbs),
    ringExpands: end.ringRadiusPx > start.ringRadiusPx,
    ringFades: end.ringOpacity < 0.001,
    ringOpacityMonotonic: isMonotonicNonIncreasing(ringOpacityTimeline),
    ringRadiusMonotonic: isMonotonicNonDecreasing(ringRadiusTimeline),
    bloomReturnsToZero: end.bloom < 0.001,
    timelineStaysPhoneSized: timeline.length <= 15,
  });
}

const AftersignInteractionConfirmFeel = Object.freeze({
  CONFIRM_FEEL_MS,
  FRAME_MS_60FPS,
  CONFIRM_FEEL_PROFILE,
  sampleInteractionConfirm,
  makeInteractionConfirmTimeline,
  validateInteractionConfirmFeel,
});

if (typeof window !== 'undefined') {
  window.AftersignInteractionConfirmFeel = AftersignInteractionConfirmFeel;
}

if (typeof module !== 'undefined') {
  module.exports = AftersignInteractionConfirmFeel;
}
