import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PACKET_INTENT_PRESSURE_FEEL,
  evaluatePacketIntentPressure,
} from './packetIntentPressureFeel';

describe('evaluatePacketIntentPressure', () => {
  it('keeps the sealed packet choice undecided before the hold window completes', () => {
    expect(
      evaluatePacketIntentPressure({
        heldMs: DEFAULT_PACKET_INTENT_PRESSURE_FEEL.preserveHoldMs - 1,
        movedPx: 0,
        maxPressure: 0.2,
        released: false,
      }),
    ).toMatchObject({
      action: 'undecided',
      committed: false,
      reason: 'waiting',
    });
  });

  it('commits preserve only after a deliberate completed hold release', () => {
    expect(
      evaluatePacketIntentPressure({
        heldMs: DEFAULT_PACKET_INTENT_PRESSURE_FEEL.preserveHoldMs,
        movedPx: 3,
        maxPressure: 0.35,
        released: true,
      }),
    ).toEqual({
      action: 'preserve',
      committed: true,
      progress: 1,
      reason: 'hold-complete',
    });
  });

  it('commits open immediately when pressure crosses the seal-break threshold', () => {
    expect(
      evaluatePacketIntentPressure({
        heldMs: 80,
        movedPx: 2,
        maxPressure: DEFAULT_PACKET_INTENT_PRESSURE_FEEL.openPressure,
        released: false,
      }),
    ).toEqual({
      action: 'open',
      committed: true,
      progress: 1,
      reason: 'pressure-break',
    });
  });

  it('cancels instead of committing when the finger drifts outside the packet affordance', () => {
    expect(
      evaluatePacketIntentPressure({
        heldMs: DEFAULT_PACKET_INTENT_PRESSURE_FEEL.preserveHoldMs + 100,
        movedPx: DEFAULT_PACKET_INTENT_PRESSURE_FEEL.cancelMovePx + 1,
        maxPressure: 1,
        released: true,
      }),
    ).toMatchObject({
      action: 'undecided',
      committed: false,
      reason: 'gesture-cancelled',
    });
  });
});
