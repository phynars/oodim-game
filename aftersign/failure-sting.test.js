import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FAILURE_STING,
  assertFailureStingCueShape,
  createFailureStingController,
  sampleFailureSting,
} from './failure-sting.js';

test('failure sting reaches peak tint quickly and recovers within the 360ms envelope', () => {
  const start = sampleFailureSting(0);
  const attack = sampleFailureSting(FAILURE_STING.attackMs);
  const heldPeak = sampleFailureSting(FAILURE_STING.attackMs + FAILURE_STING.peakHoldMs);
  const recovered = sampleFailureSting(FAILURE_STING.recoveryMs);

  assert.equal(start.active, true);
  assert.equal(start.tintAlpha, 0);
  assert.equal(start.toneQueued, true);
  assert.ok(attack.tintAlpha >= FAILURE_STING.screenTint.peakAlpha * 0.98, `attack tint ${attack.tintAlpha} should reach peak by ${FAILURE_STING.attackMs}ms`);
  assert.ok(heldPeak.vignetteAlpha >= FAILURE_STING.vignette.peakAlpha * 0.98, `held vignette ${heldPeak.vignetteAlpha} should still be near peak`);
  assert.equal(recovered.active, false);
  assert.equal(recovered.tintAlpha, 0);
  assert.equal(recovered.cameraShakeX, 0);
  assert.equal(recovered.cameraRollDeg, 0);
});

test('failure sting controller queues one tone per trigger and clears it on consume', () => {
  const sting = createFailureStingController();

  const triggered = sting.trigger({ timeMs: 1000, source: 'missed-kiosk' });

  assert.equal(triggered.count, 1);
  assert.equal(triggered.lastSource, 'missed-kiosk');
  assert.equal(triggered.toneQueued, true);
  assert.equal(sting.consumeTone(), true);
  assert.equal(sting.consumeTone(), false);
});

test('failure sting controller exposes recovery state for window.__game harnesses', () => {
  const sting = createFailureStingController();

  sting.trigger({ timeMs: 2000, source: 'empty-air-tap' });
  const midSting = sting.tick(2000 + 120);
  const recovered = sting.tick(2000 + FAILURE_STING.recoveryMs);

  assert.equal(midSting.active, true);
  assert.equal(midSting.remainingMs, FAILURE_STING.recoveryMs - 120);
  assert.equal(recovered.active, false);
  assert.equal(recovered.remainingMs, 0);
  assert.equal(recovered.count, 1);
  assert.equal(recovered.lastSource, 'empty-air-tap');
});

test('boot assertion locks the authored failure sting cue shape', () => {
  assert.equal(assertFailureStingCueShape(), true);
});
