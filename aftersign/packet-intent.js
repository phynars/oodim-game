// AFTERSIGN packet intent model.
// Keeps the first slice choice physical: a deliberate hold breaks the seal,
// while release / move-away preserves it. Pure module so the served page and
// harness can share the same thresholds without frame-coupled DOM state.

export const PACKET_INTENT_DEFAULTS = Object.freeze({
  holdToOpenMs: 520,
  commitGraceMs: 80,
  maxStillDistancePx: 18,
});

export function createPacketIntentState(overrides = {}) {
  const config = { ...PACKET_INTENT_DEFAULTS, ...overrides };

  return {
    config,
    activePointerId: null,
    startedAtMs: 0,
    startX: 0,
    startY: 0,
    heldMs: 0,
    seal: 'sealed',
    preview: 'idle',
    committed: false,
    commit: null,
  };
}

export function beginPacketIntent(state, input) {
  if (state.committed || state.activePointerId !== null) return state;

  state.activePointerId = input.pointerId ?? 'primary';
  state.startedAtMs = input.timeMs;
  state.startX = input.x;
  state.startY = input.y;
  state.heldMs = 0;
  state.preview = 'holding-seal';

  return state;
}

export function updatePacketIntent(state, input) {
  if (state.committed || state.activePointerId !== (input.pointerId ?? 'primary')) return state;

  const dx = input.x - state.startX;
  const dy = input.y - state.startY;
  const distancePx = Math.hypot(dx, dy);
  state.heldMs = Math.max(0, input.timeMs - state.startedAtMs);

  if (distancePx > state.config.maxStillDistancePx) {
    state.preview = 'dragged-away';
    return state;
  }

  state.preview = state.heldMs >= state.config.holdToOpenMs ? 'seal-straining' : 'holding-seal';
  return state;
}

export function endPacketIntent(state, input) {
  if (state.committed || state.activePointerId !== (input.pointerId ?? 'primary')) return state;

  updatePacketIntent(state, input);

  const opensSeal =
    state.preview === 'seal-straining' &&
    state.heldMs >= state.config.holdToOpenMs + state.config.commitGraceMs;

  state.activePointerId = null;
  state.committed = true;
  state.seal = opensSeal ? 'opened' : 'sealed';
  state.preview = opensSeal ? 'seal-broken' : 'seal-preserved';
  state.commit = {
    packetOutcome: opensSeal ? 'opened' : 'sealed',
    heldMs: state.heldMs,
  };

  return state;
}

export function cancelPacketIntent(state) {
  if (state.committed) return state;

  state.activePointerId = null;
  state.heldMs = 0;
  state.preview = 'idle';
  return state;
}
