export type PacketSealState = 'sealed' | 'opened';
export type PacketIntentAction = 'keep-sealed' | 'open';
export type PacketIntentEvent =
  | { type: 'press-start'; t: number; x: number; y: number }
  | { type: 'move'; t: number; x: number; y: number }
  | { type: 'press-end'; t: number; x: number; y: number }
  | { type: 'cancel'; t: number };

export interface PacketIntentConfig {
  /** Minimum deliberate hold before opening the seal. Keeps open from feeling like menu trivia. */
  openHoldMs: number;
  /** Movement beyond this radius cancels the open hold so thumb drift does not break trust. */
  cancelRadiusPx: number;
  /** A quick release before openHoldMs preserves the packet. */
  keepSealedMaxMs: number;
}

export interface PacketIntentResult {
  action: PacketIntentAction;
  sealState: PacketSealState;
  elapsedMs: number;
  cancelled: boolean;
}

export const DEFAULT_PACKET_INTENT_CONFIG: PacketIntentConfig = {
  openHoldMs: 520,
  cancelRadiusPx: 18,
  keepSealedMaxMs: 240,
};

interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function resolvePacketIntent(
  events: PacketIntentEvent[],
  config: PacketIntentConfig = DEFAULT_PACKET_INTENT_CONFIG,
): PacketIntentResult {
  const start = events.find((event): event is Extract<PacketIntentEvent, { type: 'press-start' }> => event.type === 'press-start');

  if (!start) {
    return { action: 'keep-sealed', sealState: 'sealed', elapsedMs: 0, cancelled: true };
  }

  let cancelled = false;
  let lastT = start.t;
  const startPoint = { x: start.x, y: start.y };

  for (const event of events) {
    lastT = Math.max(lastT, event.t);

    if (event.type === 'cancel') {
      cancelled = true;
      continue;
    }

    if (event.type === 'move' || event.type === 'press-end') {
      if (distance(startPoint, event) > config.cancelRadiusPx) {
        cancelled = true;
      }
    }
  }

  const elapsedMs = Math.max(0, lastT - start.t);

  if (!cancelled && elapsedMs >= config.openHoldMs) {
    return { action: 'open', sealState: 'opened', elapsedMs, cancelled: false };
  }

  return { action: 'keep-sealed', sealState: 'sealed', elapsedMs, cancelled };
}

export function assertPacketIntentFeelContract(): void {
  const tap = resolvePacketIntent([
    { type: 'press-start', t: 0, x: 120, y: 160 },
    { type: 'press-end', t: 120, x: 122, y: 161 },
  ]);

  if (tap.action !== 'keep-sealed' || tap.sealState !== 'sealed') {
    throw new Error('Packet feel contract failed: quick tap must preserve the seal.');
  }

  const deliberateHold = resolvePacketIntent([
    { type: 'press-start', t: 0, x: 120, y: 160 },
    { type: 'move', t: 260, x: 121, y: 160 },
    { type: 'press-end', t: 540, x: 121, y: 162 },
  ]);

  if (deliberateHold.action !== 'open' || deliberateHold.sealState !== 'opened') {
    throw new Error('Packet feel contract failed: deliberate hold must open the seal.');
  }

  const thumbDrift = resolvePacketIntent([
    { type: 'press-start', t: 0, x: 120, y: 160 },
    { type: 'move', t: 300, x: 151, y: 160 },
    { type: 'press-end', t: 620, x: 151, y: 160 },
  ]);

  if (thumbDrift.action !== 'keep-sealed' || thumbDrift.sealState !== 'sealed' || !thumbDrift.cancelled) {
    throw new Error('Packet feel contract failed: thumb drift must cancel opening and preserve the seal.');
  }
}
