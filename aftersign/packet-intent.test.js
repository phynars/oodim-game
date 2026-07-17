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

test('mid-length release inside the deadzone preserves the seal (no punitive cancel)', () => {
  // Feel contract: releasing at 181–449 ms — a hesitant, in-bounds press —
  // used to CANCEL, which felt punitive: the player made an in-bounds choice
  // and got no outcome. New behavior: any in-bounds release before
  // HOLD_TO_OPEN_MS defaults to SEALED. A false-sealed is recoverable
  // (press again); a false-opened is not (trust is spent). This test pins
  // the deadzone default so it can't silently regress back to CANCELLED.
  const packet = new PacketIntentController();

  packet.press({ timeMs: 3000, x: 60, y: 60 });
  const result = packet.release({ timeMs: 3000 + PACKET_INTENT.TAP_TO_PRESERVE_MAX_MS + 1, x: 60, y: 60 });

  assert.equal(result.outcome, PACKET_OUTCOME.SEALED);
  assert.equal(result.active, false);
  assert.equal(result.progress, 0);
});

test('release one tick before HOLD_TO_OPEN_MS still preserves the seal', () => {
  // Upper boundary of the deadzone: releasing at HOLD_TO_OPEN_MS − 1 must
  // stay SEALED. The open commit only fires at or past the full hold window.
  const packet = new PacketIntentController();

  packet.press({ timeMs: 6000, x: 70, y: 70 });
  const result = packet.release({
    timeMs: 6000 + PACKET_INTENT.HOLD_TO_OPEN_MS - 1,
    x: 70,
    y: 70,
  });

  assert.equal(result.outcome, PACKET_OUTCOME.SEALED);
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

test('drift-cancel is sticky: a subsequent tick past the hold threshold cannot resurrect OPENED', () => {
  // Feel contract: once a gesture drifts out of the interaction radius it is
  // committed to CANCELLED and the packet stays sealed. If the rAF loop keeps
  // calling tick() after the cancel (which it does, because the scene doesn't
  // know the outcome yet on that frame), the packet must NOT quietly open at
  // HOLD_TO_OPEN_MS. A false-opened is unrecoverable; this test pins that.
  const packet = new PacketIntentController();
  const t0 = 30_000;

  packet.press({ timeMs: t0, x: 100, y: 100 });
  const drifted = packet.move({
    timeMs: t0 + 50,
    x: 100 + PACKET_INTENT.DRIFT_CANCEL_PX + 1,
    y: 100,
  });
  assert.equal(drifted.outcome, PACKET_OUTCOME.CANCELLED);

  // Simulate the rAF loop continuing to tick well past the hold threshold.
  let last = drifted;
  for (let t = t0 + 50; t <= t0 + PACKET_INTENT.HOLD_TO_OPEN_MS + 200; t += 16) {
    last = packet.tick(t);
  }

  assert.equal(last.outcome, PACKET_OUTCOME.CANCELLED, 'cancelled gesture must stay cancelled');
  assert.equal(last.active, false);
  assert.equal(last.progress, 0);
});

test('reset() re-arms the controller so the player can attempt the choice again', () => {
  // Feel contract: after any committed outcome (SEALED / OPENED / CANCELLED)
  // the scene must be able to re-arm for a fresh attempt — e.g. the player
  // brushed the packet, got a stray CANCELLED, and now genuinely wants to
  // hold. Without reset() there is no path back to UNKNOWN, and a stuck
  // outcome would silently block the next gesture from advancing.
  const packet = new PacketIntentController();

  packet.press({ timeMs: 7000, x: 50, y: 50 });
  const cancelled = packet.move({
    timeMs: 7050,
    x: 50 + PACKET_INTENT.DRIFT_CANCEL_PX + 1,
    y: 50,
  });
  assert.equal(cancelled.outcome, PACKET_OUTCOME.CANCELLED);

  const rearmed = packet.reset();
  assert.equal(rearmed.outcome, PACKET_OUTCOME.UNKNOWN, 'reset must clear the committed outcome');
  assert.equal(rearmed.active, false);
  assert.equal(rearmed.progress, 0);

  // A fresh deliberate hold after reset() must open the packet normally.
  packet.press({ timeMs: 8000, x: 50, y: 50 });
  const opened = packet.tick(8000 + PACKET_INTENT.HOLD_TO_OPEN_MS);
  assert.equal(opened.outcome, PACKET_OUTCOME.OPENED, 'reset controller must accept a fresh open');
  assert.equal(opened.progress, 1);
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
