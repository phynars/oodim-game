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

test('stationary press-and-hold opens via tick() without any pointer movement', () => {
  // Primary open gesture on mouse and touch: press and hold, don't wiggle.
  // The rAF/tick loop must advance progress and fire OPENED with no move events.
  const packet = new PacketIntentController();
  const t0 = 10_000;

  packet.press({ timeMs: t0, x: 100, y: 100 });

  // Simulate a 60fps tick loop for the full hold window. No move() calls.
  const frameMs = 16;
  let last = packet.snapshot();
  for (let t = t0 + frameMs; t <= t0 + PACKET_INTENT.HOLD_TO_OPEN_MS; t += frameMs) {
    last = packet.tick(t);
    if (last.outcome) break;
  }

  assert.equal(last.outcome, PACKET_OUTCOME.OPENED, 'stationary hold must open the packet');
  assert.equal(last.active, false);
  assert.equal(last.progress, 1);
});

test('tick() before the hold threshold advances progress but does not open', () => {
  // Pre-break feedback (docs/flagship/ivy-packet-action-review.md: 120ms) requires
  // progress to be strictly between 0 and 1 mid-hold, without a premature OPENED.
  const packet = new PacketIntentController();
  const t0 = 20_000;
  const midHoldMs = Math.floor(PACKET_INTENT.HOLD_TO_OPEN_MS / 2);

  packet.press({ timeMs: t0, x: 5, y: 5 });
  const result = packet.tick(t0 + midHoldMs);

  assert.equal(result.outcome, null, 'must not open before the hold threshold');
  assert.equal(result.active, true);
  assert.ok(result.progress > 0 && result.progress < 1, `progress should be mid-hold, got ${result.progress}`);
});

test('HOLD_TO_OPEN_MS matches the 450ms spec in ivy-packet-action-review.md', () => {
  // Five references in docs/flagship/ivy-packet-action-review.md pin this at 450ms.
  // Any drift from the spec should fail this test and force a doc-side change first.
  assert.equal(PACKET_INTENT.HOLD_TO_OPEN_MS, 450);
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
