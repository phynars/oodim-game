import assert from 'node:assert/strict';
import {
  FAILURE_STING,
  FAILURE_STING_FEEL_CONTRACT,
  assertFailureStingCueShape,
  sampleFailureSting,
} from './failure-sting.js';

const within = (actual, min, max, label) => {
  assert.ok(
    actual >= min && actual <= max,
    `${label}: expected ${actual} to be between ${min} and ${max}`,
  );
};

export const assertFailureStingFeel = () => {
  assertFailureStingCueShape();

  const start = sampleFailureSting(0);
  const coupled = sampleFailureSting(FAILURE_STING_FEEL_CONTRACT.couplingWindowMs);
  const peak = sampleFailureSting(FAILURE_STING.attackMs);
  const afterPeakHold = sampleFailureSting(FAILURE_STING.attackMs + FAILURE_STING.peakHoldMs);
  const finalFrame = sampleFailureSting(FAILURE_STING.durationMs - 1);
  const recovered = sampleFailureSting(FAILURE_STING.recoveryMs);

  assert.equal(start.active, true, 'failure sting starts active on the trigger frame');
  assert.equal(coupled.active, true, 'failure sting remains active through the audio-visual coupling window');
  assert.equal(peak.active, true, 'failure sting is still active at the visual peak');
  assert.equal(afterPeakHold.active, true, 'failure sting holds the peak long enough to be felt');
  assert.equal(finalFrame.active, true, 'failure sting remains active until the last animation frame');
  assert.equal(recovered.active, false, 'failure sting returns to rest by recoveryMs');

  within(FAILURE_STING.durationMs, 120, 260, 'durationMs');
  within(FAILURE_STING.attackMs, 16, 64, 'attackMs');
  within(FAILURE_STING.peakHoldMs, 16, 80, 'peakHoldMs');
  within(FAILURE_STING.recoveryMs, FAILURE_STING.durationMs, FAILURE_STING.durationMs + 120, 'recoveryMs');
  within(FAILURE_STING_FEEL_CONTRACT.couplingWindowMs, 0, 50, 'couplingWindowMs');

  assert.ok(peak.cameraKickWorldX > start.cameraKickWorldX, 'camera x-kick ramps up during attack');
  assert.ok(Math.abs(peak.cameraYawDegrees) >= Math.abs(coupled.cameraYawDegrees), 'yaw reaches or exceeds its coupled-frame sample by peak');
  assert.ok(peak.hudShakeX >= coupled.hudShakeX, 'HUD shake reaches or exceeds its coupled-frame sample by peak');
  assert.ok(finalFrame.flashAlpha < peak.flashAlpha, 'flash decays before recovery');
  assert.ok(recovered.flashAlpha === 0, 'flash rests at zero after recovery');
};

assertFailureStingFeel();
