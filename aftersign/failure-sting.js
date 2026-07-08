/**
 * AFTERSIGN vertical-slice feel primitive: player-error failure sting.
 *
 * Dependency-free so the headless harness can assert the sting envelope without
 * booting three.js or touching durable session state. The scene should call
 * createFailureStingController().trigger() on an invalid player action, sample
 * it every frame, and mirror the latest snapshot through window.__game.
 */

export const FAILURE_STING = Object.freeze({
  durationMs: 360,
  recoveryMs: 360,
  attackMs: 32,
  peakHoldMs: 48,
  easing: 'easeOutCubic',
  screenTint: {
    peakAlpha: 0.38,
    color: '#ff3d7a',
  },
  vignette: {
    peakAlpha: 0.28,
  },
  cameraShakePx: 7,
  cameraRollDeg: 0.8,
  tone: {
    oneShot: true,
    frequencyHz: 146.83,
    durationMs: 120,
    attackMs: 6,
    decayMs: 114,
    gain: 0.1,
  },
});

export const FAILURE_STING_FEEL_CONTRACT = Object.freeze({
  targetFps: 60,
  maxAttackFrames: 2,
  couplingWindowMs: 16.67,
  maxRecoveryMs: 360,
  minFirstFrameTintAlpha: 0.08,
  minFirstFrameShakePx: 0.45,
  minPeakShakePx: 4.5,
  maxSettleShakePx: 0.2,
});

export const FAILURE_STING_REST_SAMPLE = Object.freeze({
  active: false,
  elapsedMs: FAILURE_STING.durationMs,
  remainingMs: 0,
  tintAlpha: 0,
  vignetteAlpha: 0,
  cameraShakeX: 0,
  cameraShakeY: 0,
  cameraRollDeg: 0,
  toneQueued: false,
});

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

export const sampleFailureSting = (elapsedMs) => {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed >= FAILURE_STING.durationMs) {
    return { ...FAILURE_STING_REST_SAMPLE };
  }

  const attack = clamp01(elapsed / FAILURE_STING.attackMs);
  const decayStart = FAILURE_STING.attackMs + FAILURE_STING.peakHoldMs;
  const decay = elapsed <= decayStart
    ? 1
    : 1 - easeOutCubic(clamp01((elapsed - decayStart) / (FAILURE_STING.durationMs - decayStart)));
  const envelope = easeOutCubic(attack) * decay;
  const shakeWave = Math.sin(elapsed * 0.19) * envelope;
  const rollWave = Math.sin(elapsed * 0.13 + Math.PI / 2) * envelope;

  return {
    active: true,
    elapsedMs: Math.round(elapsed),
    remainingMs: Math.max(0, Math.round(FAILURE_STING.durationMs - elapsed)),
    tintAlpha: Number((FAILURE_STING.screenTint.peakAlpha * envelope).toFixed(3)),
    vignetteAlpha: Number((FAILURE_STING.vignette.peakAlpha * envelope).toFixed(3)),
    cameraShakeX: Number((FAILURE_STING.cameraShakePx * shakeWave).toFixed(3)),
    cameraShakeY: Number((-FAILURE_STING.cameraShakePx * Math.cos(elapsed * 0.17) * envelope).toFixed(3)),
    cameraRollDeg: Number((FAILURE_STING.cameraRollDeg * rollWave).toFixed(3)),
    toneQueued: elapsed === 0,
  };
};

export const createFailureStingController = () => {
  let startedAt = null;
  let count = 0;
  let lastSource = null;
  let toneQueued = false;

  const snapshot = (nowMs = 0) => {
    if (startedAt === null) {
      return {
        count,
        lastSource,
        ...FAILURE_STING_REST_SAMPLE,
      };
    }

    const sample = sampleFailureSting(nowMs - startedAt);
    if (!sample.active) {
      startedAt = null;
      toneQueued = false;
    }

    return {
      count,
      lastSource,
      ...sample,
      toneQueued: toneQueued || sample.toneQueued,
    };
  };

  return {
    trigger({ timeMs = 0, source = 'unknown' } = {}) {
      startedAt = timeMs;
      count += 1;
      lastSource = source;
      toneQueued = true;
      return snapshot(timeMs);
    },
    consumeTone() {
      const queued = toneQueued;
      toneQueued = false;
      return queued;
    },
    tick(timeMs = 0) {
      return snapshot(timeMs);
    },
    snapshot,
  };
};

export const assertFailureStingCueShape = () => {
  const start = sampleFailureSting(0);
  const firstFrame = sampleFailureSting(FAILURE_STING_FEEL_CONTRACT.couplingWindowMs);
  const attack = sampleFailureSting(FAILURE_STING.attackMs);
  const heldPeak = sampleFailureSting(FAILURE_STING.attackMs + FAILURE_STING.peakHoldMs);
  const lateSettle = sampleFailureSting(FAILURE_STING.durationMs - FAILURE_STING_FEEL_CONTRACT.couplingWindowMs);
  const recovered = sampleFailureSting(FAILURE_STING.recoveryMs);

  if (start.tintAlpha !== 0 || !start.toneQueued) {
    throw new Error('failure sting must start visually clean while queuing its one-shot tone');
  }

  if (attack.tintAlpha < FAILURE_STING.screenTint.peakAlpha * 0.98) {
    throw new Error(`failure sting attack must reach peak tint by ${FAILURE_STING.attackMs}ms`);
  }

  if (heldPeak.vignetteAlpha < FAILURE_STING.vignette.peakAlpha * 0.98) {
    throw new Error(`failure sting must hold peak vignette through ${FAILURE_STING.peakHoldMs}ms`);
  }

  if (recovered.active || recovered.tintAlpha !== 0 || recovered.cameraShakeX !== 0 || recovered.cameraRollDeg !== 0) {
    throw new Error(`failure sting must fully recover by ${FAILURE_STING.recoveryMs}ms`);
  }

  if (FAILURE_STING.attackMs > FAILURE_STING_FEEL_CONTRACT.maxAttackFrames * (1000 / FAILURE_STING_FEEL_CONTRACT.targetFps)) {
    throw new Error(`failure sting attack must stay within ${FAILURE_STING_FEEL_CONTRACT.maxAttackFrames} frames at ${FAILURE_STING_FEEL_CONTRACT.targetFps}fps`);
  }

  if (FAILURE_STING.recoveryMs > FAILURE_STING_FEEL_CONTRACT.maxRecoveryMs) {
    throw new Error(`failure sting recovery must stay at or below ${FAILURE_STING_FEEL_CONTRACT.maxRecoveryMs}ms`);
  }

  const firstFrameShake = Math.hypot(firstFrame.cameraShakeX, firstFrame.cameraShakeY);
  if (firstFrame.tintAlpha < FAILURE_STING_FEEL_CONTRACT.minFirstFrameTintAlpha) {
    throw new Error(`failure sting tint must reach at least ${FAILURE_STING_FEEL_CONTRACT.minFirstFrameTintAlpha} alpha by ${FAILURE_STING_FEEL_CONTRACT.couplingWindowMs}ms`);
  }

  if (firstFrameShake < FAILURE_STING_FEEL_CONTRACT.minFirstFrameShakePx) {
    throw new Error(`failure sting camera shake must be >= ${FAILURE_STING_FEEL_CONTRACT.minFirstFrameShakePx}px by ${FAILURE_STING_FEEL_CONTRACT.couplingWindowMs}ms`);
  }

  const peakShake = Math.max(
    Math.hypot(attack.cameraShakeX, attack.cameraShakeY),
    Math.hypot(heldPeak.cameraShakeX, heldPeak.cameraShakeY),
  );
  if (peakShake < FAILURE_STING_FEEL_CONTRACT.minPeakShakePx) {
    throw new Error(`failure sting peak shake must reach at least ${FAILURE_STING_FEEL_CONTRACT.minPeakShakePx}px`);
  }

  const settleShake = Math.hypot(lateSettle.cameraShakeX, lateSettle.cameraShakeY);
  if (settleShake > FAILURE_STING_FEEL_CONTRACT.maxSettleShakePx) {
    throw new Error(`failure sting must settle below ${FAILURE_STING_FEEL_CONTRACT.maxSettleShakePx}px shake before recovery`);
  }

  return true;
};
