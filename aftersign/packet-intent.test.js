import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PACKET_INTENT,
  PACKET_OUTCOME,
  PacketIntentController,
  createPacketIntentHarness,
} from './packet-intent.js';

test('quick tap preserves the sealed packet', () => {
  const packet = new PacketIntentController();

  packet.press({ timeMs: 1000, x: 20, y: 20 });
  const result = packet.release({ timeMs: 1000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS, x: 20, y: 20 });

  assert.equal(result.outcome, PACKET_OUTCOME.SEALED);
  assert.equal(result.active, false);
  assert.equal(result.progress, 0);
});

test('deliberate hold opens the packet after the full hold window', () => {
  const packet = new PacketIntentController();

  packet.press({ timeMs: 2000, x: 40, y: 40 });
  const result = packet.move({ timeMs: 2000 + PACKET_INTENT.HOLD_TO_OPEN_MS, x: 40, y: 40 });

  assert.equal(result.outcome, PACKET_OUTCOME.OPENED);
  assert.equal(result.active, false);
  assert.equal(result.progress, 1);
});

test('mid-length press cancels instead of accidentally opening or preserving', () => {
  const packet = new PacketIntentController();

  packet.press({ timeMs: 3000, x: 60, y: 60 });
  const result = packet.release({ timeMs: 3000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS + 1, x: 60, y: 60 });

  assert.equal(result.outcome, PACKET_OUTCOME.CANCELLED);
  assert.equal(result.active, false);
  assert.equal(result.progress, 0);
});

test('dragging outside the interaction radius cancels without committing a packet choice', () => {
  const packet = new PacketIntentController();

  packet.press({ timeMs: 4000, x: 80, y: 80 });
  const result = packet.move({ timeMs: 4100, x: 80 + PACKET_INTENT.DRIFT_CANCEL_PX + 1, y: 80 });

  assert.equal(result.outcome, PACKET_OUTCOME.CANCELLED);
  assert.equal(result.active, false);
  assert.equal(result.progress, 0);
});

test('harness mirrors packet outcome for window.__game story state', () => {
  const harness = createPacketIntentHarness();

  harness.press({ timeMs: 5000, x: 12, y: 12 });
  harness.release({ timeMs: 5000 + 90, x: 12, y: 12 });

  assert.deepEqual(harness.state, {
    packetOutcome: PACKET_OUTCOME.SEALED,
    packetOpenProgress: 0,
  });
});
