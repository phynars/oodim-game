// AFTERSIGN packet action feel model.
// Purpose: make the first packet choice feel intentional on touch screens.
// A quick tap previews the packet state; a deliberate hold commits to opening it.
// Keeping the seal is always an explicit action, never the accidental default.

export const PACKET_ACTION_FEEL = Object.freeze({
  tapPreviewMaxMs: 180,
  holdToOpenMs: 420,
  cancelRadiusPx: 18,
});

export function createPacketActionFeel(config = {}) {
  const feel = { ...PACKET_ACTION_FEEL, ...config };
  let gesture = null;

  function begin(pointerId, x, y, nowMs) {
    gesture = {
      pointerId,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      startedAtMs: nowMs,
      cancelled: false,
      opened: false,
      previewed: false,
    };

    return snapshot('pressing', nowMs);
  }

  function move(pointerId, x, y, nowMs) {
    if (!gesture || gesture.pointerId !== pointerId) return snapshot('idle', nowMs);

    gesture.lastX = x;
    gesture.lastY = y;

    const dx = x - gesture.startX;
    const dy = y - gesture.startY;
    if (Math.hypot(dx, dy) > feel.cancelRadiusPx) {
      gesture.cancelled = true;
      return snapshot('cancelled', nowMs);
    }

    if (!gesture.opened && elapsed(nowMs) >= feel.holdToOpenMs) {
      gesture.opened = true;
      return snapshot('open-packet', nowMs);
    }

    return snapshot('pressing', nowMs);
  }

  function end(pointerId, nowMs) {
    if (!gesture || gesture.pointerId !== pointerId) return snapshot('idle', nowMs);

    const durationMs = elapsed(nowMs);
    const wasCancelled = gesture.cancelled;
    const wasOpened = gesture.opened;
    const shouldPreview = !wasCancelled && !wasOpened && durationMs <= feel.tapPreviewMaxMs;

    const result = wasCancelled
      ? snapshot('cancelled', nowMs)
      : wasOpened
        ? snapshot('opened', nowMs)
        : shouldPreview
          ? snapshot('preview-packet', nowMs)
          : snapshot('keep-sealed', nowMs);

    gesture = null;
    return result;
  }

  function chooseKeepSealed(nowMs) {
    gesture = null;
    return {
      state: 'keep-sealed',
      action: 'keep-sealed',
      progress: 0,
      elapsedMs: 0,
      timestampMs: nowMs,
    };
  }

  function snapshot(state, nowMs) {
    const elapsedMs = elapsed(nowMs);
    return {
      state,
      action: actionForState(state),
      progress: gesture ? clamp01(elapsedMs / feel.holdToOpenMs) : 0,
      elapsedMs,
      timestampMs: nowMs,
    };
  }

  function elapsed(nowMs) {
    return gesture ? Math.max(0, nowMs - gesture.startedAtMs) : 0;
  }

  return {
    begin,
    move,
    end,
    chooseKeepSealed,
    get activeGesture() {
      return gesture ? { ...gesture } : null;
    },
    get thresholds() {
      return { ...feel };
    },
  };
}

function actionForState(state) {
  switch (state) {
    case 'preview-packet':
      return 'preview';
    case 'open-packet':
    case 'opened':
      return 'open';
    case 'keep-sealed':
      return 'keep-sealed';
    case 'cancelled':
      return 'cancel';
    default:
      return null;
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
