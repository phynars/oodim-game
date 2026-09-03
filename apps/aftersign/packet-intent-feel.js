// AFTERSIGN packet-intent feel model.
// Pure, dependency-free gameplay code so the served page can import it without a build step.

export const PACKET_INTENT = Object.freeze({
  keepSealed: 'keep-sealed',
  openSeal: 'open-seal',
});

export const PACKET_PRESS = Object.freeze({
  holdMs: 260,
  dragCancelPx: 14,
  commitPulseMs: 120,
});

export function createPacketIntentState(nowMs = 0) {
  return {
    intent: null,
    pressedAtMs: null,
    pointerId: null,
    originX: 0,
    originY: 0,
    committedAtMs: null,
    cancelled: false,
    lastReason: 'idle',
  };
}

export function pressPacketIntent(state, intent, pointerId, x, y, nowMs) {
  if (!Object.values(PACKET_INTENT).includes(intent)) {
    return { ...state, lastReason: 'ignored-unknown-intent' };
  }

  return {
    ...state,
    intent,
    pointerId,
    originX: x,
    originY: y,
    pressedAtMs: nowMs,
    committedAtMs: null,
    cancelled: false,
    lastReason: 'pressed',
  };
}

export function movePacketIntent(state, pointerId, x, y) {
  if (state.pointerId !== pointerId || state.pressedAtMs === null || state.cancelled) {
    return state;
  }

  const dx = x - state.originX;
  const dy = y - state.originY;
  const distance = Math.hypot(dx, dy);
  if (distance <= PACKET_PRESS.dragCancelPx) {
    return state;
  }

  return {
    ...state,
    intent: null,
    pointerId: null,
    pressedAtMs: null,
    cancelled: true,
    lastReason: 'cancelled-drag',
  };
}

export function releasePacketIntent(state, pointerId, nowMs) {
  if (state.pointerId !== pointerId || state.pressedAtMs === null || state.cancelled) {
    return { state, committedIntent: null };
  }

  const heldMs = nowMs - state.pressedAtMs;
  if (heldMs < PACKET_PRESS.holdMs) {
    return {
      state: {
        ...state,
        intent: null,
        pointerId: null,
        pressedAtMs: null,
        lastReason: 'released-too-fast',
      },
      committedIntent: null,
    };
  }

  const committedIntent = state.intent;
  return {
    state: {
      ...state,
      pointerId: null,
      pressedAtMs: null,
      committedAtMs: nowMs,
      lastReason: 'committed',
    },
    committedIntent,
  };
}

export function packetIntentProgress(state, nowMs) {
  if (state.pressedAtMs === null || state.cancelled) {
    return 0;
  }

  return Math.max(0, Math.min(1, (nowMs - state.pressedAtMs) / PACKET_PRESS.holdMs));
}

export function packetIntentPulse(state, nowMs) {
  if (state.committedAtMs === null) {
    return 0;
  }

  const elapsed = nowMs - state.committedAtMs;
  if (elapsed < 0 || elapsed > PACKET_PRESS.commitPulseMs) {
    return 0;
  }

  return 1 - elapsed / PACKET_PRESS.commitPulseMs;
}
