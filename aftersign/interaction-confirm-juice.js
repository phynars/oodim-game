const FRAME_MS = 1000 / 60;

export const INTERACTION_CONFIRM_JUICE = Object.freeze({
  pressScale: 0.965,
  settleScale: 1,
  pressMs: 50,
  reboundMs: 116.6666666667,
  glowPx: 10,
  shakePx: 1.25,
  hapticMs: 12,
  audioStartHz: 740,
  audioEndHz: 1180,
  audioMs: 80,
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function quantizeMs(ms) {
  return Math.round(ms / FRAME_MS) * FRAME_MS;
}

export function createInteractionConfirmJuice(nowMs, options = {}) {
  const config = { ...INTERACTION_CONFIRM_JUICE, ...options };
  const pressMs = quantizeMs(config.pressMs);
  const reboundMs = quantizeMs(config.reboundMs);

  return Object.freeze({
    startedAtMs: nowMs,
    pressUntilMs: nowMs + pressMs,
    endsAtMs: nowMs + pressMs + reboundMs,
    pressMs,
    reboundMs,
    pressScale: config.pressScale,
    settleScale: config.settleScale,
    glowPx: config.glowPx,
    shakePx: config.shakePx,
    hapticMs: config.hapticMs,
    audioStartHz: config.audioStartHz,
    audioEndHz: config.audioEndHz,
    audioMs: config.audioMs,
  });
}

export function sampleInteractionConfirm(juice, nowMs) {
  if (!juice || nowMs >= juice.endsAtMs) {
    return Object.freeze({
      active: false,
      scale: 1,
      glowAlpha: 0,
      shakeX: 0,
      audioHz: 0,
    });
  }

  if (nowMs <= juice.pressUntilMs) {
    const k = clamp01((nowMs - juice.startedAtMs) / juice.pressMs);
    const scale = 1 + (juice.pressScale - 1) * k;
    return Object.freeze({
      active: true,
      scale,
      glowAlpha: 0.35 * k,
      shakeX: juice.shakePx * Math.sin(k * Math.PI * 2),
      audioHz: juice.audioStartHz,
    });
  }

  const reboundK = clamp01((nowMs - juice.pressUntilMs) / juice.reboundMs);
  const eased = easeOutBack(reboundK);
  const scale = juice.pressScale + (juice.settleScale - juice.pressScale) * eased;
  const audioK = clamp01((nowMs - juice.startedAtMs) / juice.audioMs);

  return Object.freeze({
    active: true,
    scale,
    glowAlpha: 0.35 * (1 - reboundK),
    shakeX: juice.shakePx * (1 - reboundK) * Math.sin(reboundK * Math.PI * 4),
    audioHz: juice.audioStartHz + (juice.audioEndHz - juice.audioStartHz) * audioK,
  });
}
