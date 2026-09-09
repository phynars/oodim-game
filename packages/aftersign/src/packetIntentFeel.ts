/**
 * AFTERSIGN packet-intent feel model.
 *
 * The first meaningful action in the slice is deciding whether to preserve or
 * open Io's sealed blue packet. This model keeps that action intentional:
 * - opening requires a sustained press, not a stray tap;
 * - preserving is a quick confirm tap;
 * - meaningful pointer travel cancels the opening hold so movement does not
 *   accidentally break the seal.
 *
 * Pure TypeScript on purpose: gameplay code can consume the same thresholds as
 * the served page while tests assert the feel contract without WebGL timing.
 */

export type PacketSealState = 'sealed' | 'opened';
export type PacketIntent = 'none' | 'preserve' | 'open';

export interface PacketIntentConfig {
  /** Minimum press duration, in ms, required to intentionally open the packet. */
  openHoldMs: number;
  /** Maximum quick-tap duration, in ms, that counts as a preserve intent. */
  preserveTapMaxMs: number;
  /** Pointer travel, in CSS px, beyond which an open hold is cancelled. */
  cancelTravelPx: number;
}

export interface PacketPointerSample {
  timeMs: number;
  x: number;
  y: number;
}

export interface PacketPress {
  start: PacketPointerSample;
  end: PacketPointerSample;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 520,
  preserveTapMaxMs: 180,
  cancelTravelPx: 14,
};

export function classifyPacketIntent(
  press: PacketPress,
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntent {
  const durationMs = Math.max(0, press.end.timeMs - press.start.timeMs);
  const travelPx = distance(press.start, press.end);

  if (durationMs <= config.preserveTapMaxMs) {
    return 'preserve';
  }

  if (durationMs >= config.openHoldMs && travelPx <= config.cancelTravelPx) {
    return 'open';
  }

  return 'none';
}

export function applyPacketIntent(
  state: PacketSealState,
  intent: PacketIntent,
): PacketSealState {
  if (state === 'opened') {
    return 'opened';
  }

  return intent === 'open' ? 'opened' : 'sealed';
}

function distance(a: PacketPointerSample, b: PacketPointerSample): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function assertPacketIntentFeel(): void {
  const stillPress: PacketPress = {
    start: { timeMs: 0, x: 120, y: 240 },
    end: { timeMs: DEFAULT_PACKET_INTENT_CONFIG.openHoldMs, x: 120, y: 240 },
  };

  const quickTap: PacketPress = {
    start: { timeMs: 0, x: 120, y: 240 },
    end: { timeMs: DEFAULT_PACKET_INTENT_CONFIG.preserveTapMaxMs, x: 123, y: 241 },
  };

  const draggedHold: PacketPress = {
    start: { timeMs: 0, x: 120, y: 240 },
    end: {
      timeMs: DEFAULT_PACKET_INTENT_CONFIG.openHoldMs + 200,
      x: 120 + DEFAULT_PACKET_INTENT_CONFIG.cancelTravelPx + 1,
      y: 240,
    },
  };

  assertEqual(classifyPacketIntent(stillPress), 'open', 'stationary hold opens packet');
  assertEqual(classifyPacketIntent(quickTap), 'preserve', 'quick tap preserves packet');
  assertEqual(classifyPacketIntent(draggedHold), 'none', 'dragged hold cancels packet opening');
  assertEqual(applyPacketIntent('sealed', 'open'), 'opened', 'open intent breaks seal');
  assertEqual(applyPacketIntent('opened', 'preserve'), 'opened', 'opened packet cannot be resealed');
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
