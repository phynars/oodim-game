const EASE_OUT_CUBIC = (t) => 1 - Math.pow(1 - t, 3);
const EASE_OUT_BACK = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const DEFAULT_CONFIRM = Object.freeze({
  durationMs: 220,
  liftPx: 10,
  ringScale: 1.18,
  flashAlpha: 0.38,
  cameraKickDeg: 0.35,
});

export function createFeelState(now = 0) {
  return {
    confirmBursts: [],
    lastUpdatedAt: now,
  };
}

export function triggerInteractionConfirm(feel, x, y, now = performance.now(), options = {}) {
  const spec = { ...DEFAULT_CONFIRM, ...options };
  feel.confirmBursts.push({
    x,
    y,
    startMs: now,
    durationMs: spec.durationMs,
    liftPx: spec.liftPx,
    ringScale: spec.ringScale,
    flashAlpha: spec.flashAlpha,
    cameraKickDeg: spec.cameraKickDeg,
  });
  return feel;
}

export function updateFeel(feel, now = performance.now()) {
  feel.lastUpdatedAt = now;
  feel.confirmBursts = feel.confirmBursts.filter((burst) => now - burst.startMs < burst.durationMs);
  return feel;
}

export function sampleInteractionConfirm(burst, now) {
  const ageMs = Math.max(0, now - burst.startMs);
  const t = Math.min(1, ageMs / burst.durationMs);
  const rise = EASE_OUT_CUBIC(t);
  const pop = EASE_OUT_BACK(Math.min(1, t / 0.72));
  const fade = 1 - EASE_OUT_CUBIC(t);

  return {
    x: burst.x,
    y: burst.y - burst.liftPx * rise,
    ringScale: 1 + (burst.ringScale - 1) * pop,
    alpha: burst.flashAlpha * fade,
    cameraKickDeg: burst.cameraKickDeg * fade,
    done: t >= 1,
  };
}

export function drawInteractionConfirm(ctx, burst, now) {
  const frame = sampleInteractionConfirm(burst, now);
  if (frame.done || frame.alpha <= 0) return frame;

  ctx.save();
  ctx.globalAlpha = frame.alpha;
  ctx.strokeStyle = '#c7fff1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(frame.x, frame.y, 14 * frame.ringScale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = Math.min(1, frame.alpha * 1.4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(frame.x, frame.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return frame;
}

export const interactionConfirmFeelSpec = Object.freeze({
  durationMs: DEFAULT_CONFIRM.durationMs,
  liftPx: DEFAULT_CONFIRM.liftPx,
  ringScale: DEFAULT_CONFIRM.ringScale,
  flashAlpha: DEFAULT_CONFIRM.flashAlpha,
  cameraKickDeg: DEFAULT_CONFIRM.cameraKickDeg,
  easing: 'ease-out-back pop to 72%, ease-out-cubic rise/fade',
});
