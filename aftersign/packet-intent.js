/**
 * AFTERSIGN vertical-slice feel primitive: the sealed packet choice.
 *
 * This is intentionally dependency-free so the WebGL/headless harness can run it
 * before the three.js scene exists. The scene should feed pointer/keyboard/touch
 * input into this controller and expose the resulting state through window.__game.
 */

export const PACKET_INTENT = Object.freeze({
  HOLD_TO_OPEN_MS: 550,
  TAP_TO_PRESERVE_MAX_MS: 180,
  DRIFT_CANCEL_PX: 14,
  PROGRESS_DEADBAND_MS: 80,
});

export const PACKET_OUTCOME = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
  CANCELLED: 'cancelled',
});

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function distancePx(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Converts raw press/release input into one explicit packet choice.
 *
 * Feel contract:
 * - quick tap preserves the seal; it should feel like confirming restraint;
 * - deliberate hold opens the packet; it cannot happen by accidental brush;
 * - dragging out of the small radius cancels instead of committing a choice.
 */
export class PacketIntentController {
  constructor(config = {}) {
    this.config = { ...PACKET_INTENT, ...config };
    this.reset();
  }

  reset() {
    this.active = false;
    this.startTimeMs = 0;
    this.startPoint = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.outcome = null;
    this.progress = 0;
    return this.snapshot();
  }

  press({ timeMs, x, y }) {
    this.active = true;
    this.startTimeMs = timeMs;
    this.startPoint = { x, y };
    this.lastPoint = { x, y };
    this.outcome = null;
    this.progress = 0;
    return this.snapshot();
  }

  move({ timeMs, x, y }) {
    if (!this.active || this.outcome) return this.snapshot();
    this.lastPoint = { x, y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
      this.active = false;
      this.progress = 0;
      return this.snapshot();
    }

    this.progress = this.openProgressAt(timeMs);
    if (this.progress >= 1) {
      this.outcome = PACKET_OUTCOME.OPENED;
      this.active = false;
    }
    return this.snapshot();
  }

  release({ timeMs, x, y }) {
    if (!this.active || this.outcome) return this.snapshot();
    this.lastPoint = { x, y };

    if (distancePx(this.startPoint, this.lastPoint) > this.config.DRIFT_CANCEL_PX) {
      this.outcome = PACKET_OUTCOME.CANCELLED;
    } else {
      const heldMs = timeMs - this.startTimeMs;
      this.outcome = heldMs <= this.config.TAP_TO_PRESERVE_MAX_MS
        ? PACKET_OUTCOME.SEALED
        : PACKET_OUTCOME.CANCELLED;
    }

    this.active = false;
    this.progress = 0;
    return this.snapshot();
  }

  openProgressAt(timeMs) {
    if (!this.active) return 0;
    const heldMs = Math.max(0, timeMs - this.startTimeMs - this.config.PROGRESS_DEADBAND_MS);
    const usableMs = this.config.HOLD_TO_OPEN_MS - this.config.PROGRESS_DEADBAND_MS;
    return clamp01(heldMs / usableMs);
  }

  snapshot() {
    return {
      active: this.active,
      outcome: this.outcome,
      progress: this.progress,
      config: this.config,
    };
  }
}

export function createPacketIntentHarness() {
  const controller = new PacketIntentController();
  const state = {
    packetOutcome: null,
    packetOpenProgress: 0,
  };

  function sync(snapshot) {
    state.packetOutcome = snapshot.outcome;
    state.packetOpenProgress = snapshot.progress;
    return state;
  }

  return {
    state,
    press(input) { return sync(controller.press(input)); },
    move(input) { return sync(controller.move(input)); },
    release(input) { return sync(controller.release(input)); },
    reset() { return sync(controller.reset()); },
  };
}
