import assert from "node:assert/strict";

import {
  recognitionFeedbackContract,
  sampleRecognitionFeedbackBeat,
  toRecognitionMemoryBeatSnapshot,
} from "./recognitionFeedback";

function inBand(value: number, min: number, max: number): void {
  assert.ok(value >= min && value <= max, `${value} expected in ${min}..${max}`);
}

{
  const peak = sampleRecognitionFeedbackBeat(recognitionFeedbackContract.cameraPeakMs, {
    outcome: "sealed",
    startedAt: 1000,
    lineId: "io.test.sealed",
  });
  inBand(peak.totalMs, 1100, 1350);
  inBand(peak.cameraDeltaMeters, 0.24, 0.36);
  inBand(peak.cameraYawDegrees, 3, 5);
  assert.equal(peak.cameraTargetOffsetMeters, recognitionFeedbackContract.sealedTargetOffsetMeters);
  assert.equal(peak.inputLockMs, 1220);
  assert.equal(peak.lineId, "io.test.sealed");
}

{
  const glowStart = sampleRecognitionFeedbackBeat(recognitionFeedbackContract.glowStartMs);
  const glowPeak = sampleRecognitionFeedbackBeat(
    recognitionFeedbackContract.glowStartMs + recognitionFeedbackContract.glowRiseMs,
  );
  assert.equal(glowStart.signGlowMultiplier, recognitionFeedbackContract.glowFromMultiplier);
  inBand(glowPeak.signGlowMultiplier, 1.34, 1.35);
}

{
  const sting = sampleRecognitionFeedbackBeat(recognitionFeedbackContract.stingStartMs + 90);
  assert.notEqual(sting.stingGainDb, null);
  inBand(sting.stingGainDb ?? 0, -9, -7.5);
  assert.equal(sting.stingElapsedMs, 90);
}

{
  const opened = sampleRecognitionFeedbackBeat(
    recognitionFeedbackContract.stingStartMs + recognitionFeedbackContract.openedWoodenClickDelayMs,
    { outcome: "opened" },
  );
  assert.equal(opened.outcome, "opened");
  assert.equal(opened.cameraTargetOffsetMeters, recognitionFeedbackContract.openedTargetOffsetMeters);
  assert.equal(opened.woodenClickElapsedMs, 0);
}

{
  const reduced = sampleRecognitionFeedbackBeat(160, { reducedMotion: true, outcome: "opened" });
  assert.equal(reduced.totalMs, 160);
  assert.equal(reduced.cameraDeltaMeters, 0);
  assert.equal(reduced.cameraYawDegrees, 0);
  assert.equal(reduced.inputLockMs, 160);
  assert.notEqual(reduced.stingGainDb, null);
}

{
  const done = sampleRecognitionFeedbackBeat(5000, { startedAt: 2000 });
  assert.equal(done.endedAt, 3220);
  const snapshot = toRecognitionMemoryBeatSnapshot(done);
  assert.deepEqual(Object.keys(snapshot), [
    "kind",
    "outcome",
    "startedAt",
    "endedAt",
    "cameraDeltaMeters",
    "cameraYawDegrees",
    "inputLockMs",
    "lineId",
  ]);
  assert.equal(snapshot.kind, "io-recognition");
}
