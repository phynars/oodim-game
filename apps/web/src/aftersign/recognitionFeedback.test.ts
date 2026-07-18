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
  const sealed = sampleRecognitionFeedbackBeat(recognitionFeedbackContract.stingStartMs + 8, { outcome: "sealed" });
  const opened = sampleRecognitionFeedbackBeat(
    recognitionFeedbackContract.stingStartMs + recognitionFeedbackContract.openedWoodenClickDelayMs,
    { outcome: "opened" },
  );

  assert.equal(sealed.lantern.color, "#f5c978");
  assert.equal(opened.lantern.color, "#ffe1a8");
  assert.notEqual(sealed.lantern.intensityTo, opened.lantern.intensityTo);
  assert.equal(sealed.packetSeal.audioId, "seal-wax-click");
  assert.equal(opened.packetSeal.audioId, "seal-paper-tear");
  assert.notEqual(sealed.packetSeal.color, opened.packetSeal.color);
  assert.notEqual(sealed.kioskSign.durationMs, opened.kioskSign.durationMs);
  assert.notEqual(sealed.rainRim.intensityTo, opened.rainRim.intensityTo);
  assert.notEqual(sealed.hapticScale.amplitude, opened.hapticScale.amplitude);
  assert.deepEqual(sealed.audioCueIds, ["recognition-sting", "seal-wax-click", "bell-soft"]);
  assert.deepEqual(opened.audioCueIds, ["recognition-sting", "seal-paper-tear", "bell-soft"]);
}

{
  const reduced = sampleRecognitionFeedbackBeat(160, { reducedMotion: true, outcome: "opened" });
  assert.equal(reduced.totalMs, 160);
  assert.equal(reduced.cameraDeltaMeters, 0);
  assert.equal(reduced.cameraYawDegrees, 0);
  assert.equal(reduced.inputLockMs, 160);
  assert.notEqual(reduced.stingGainDb, null);
  assert.equal(reduced.packetSeal.audioId, "seal-paper-tear");
  assert.equal(reduced.hapticScale.durationMs, 72);
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
