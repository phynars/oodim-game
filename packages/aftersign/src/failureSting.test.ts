import { FAILURE_STING_CONTRACT, cuesDueBetween, runFailureStingSelfCheck, sampleFailureSting } from "./failureSting";

const approx = (actual: number, expected: number, epsilon = 0.001): void => {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`expected ${actual} to be within ${epsilon} of ${expected}`);
  }
};

runFailureStingSelfCheck();

const start = sampleFailureSting(0);
if (start.phase !== "impact") {
  throw new Error(`expected impact phase at 0ms, got ${start.phase}`);
}
approx(start.vignetteAlpha, FAILURE_STING_CONTRACT.maxVignetteAlpha);
if (start.lowPassHz !== FAILURE_STING_CONTRACT.minLowPassHz) {
  throw new Error("failure sting should clamp audio low-pass to the contracted muffled floor on impact");
}

const recoil = sampleFailureSting(180);
if (recoil.phase !== "recoil") {
  throw new Error(`expected recoil phase at 180ms, got ${recoil.phase}`);
}
if (recoil.lowPassHz <= start.lowPassHz) {
  throw new Error("failure sting should brighten audio as the player recovers");
}
if (Math.abs(recoil.cameraYawDeg) > FAILURE_STING_CONTRACT.maxYawDeg) {
  throw new Error("failure sting yaw should stay inside the mobile comfort budget");
}

const settle = sampleFailureSting(420);
if (settle.phase !== "settle") {
  throw new Error(`expected settle phase at 420ms, got ${settle.phase}`);
}
if (settle.vignetteAlpha >= recoil.vignetteAlpha) {
  throw new Error("failure sting vignette should ease down during settle");
}

const done = sampleFailureSting(640);
if (done.phase !== "done") {
  throw new Error(`expected done phase at 640ms, got ${done.phase}`);
}
approx(done.cameraShakePx, 0);
approx(done.cameraYawDeg, 0);
approx(done.vignetteAlpha, 0);
approx(done.chromaPx, 0);
approx(done.heartbeatGain, 0);
if (done.lowPassHz !== 22050) {
  throw new Error("failure sting should restore full-band audio when complete");
}

const firstFrameCues = cuesDueBetween(-1, 16).map((cue) => cue.id).join(",");
if (firstFrameCues !== "failure-thud,soft-bump") {
  throw new Error(`unexpected first-frame cues: ${firstFrameCues}`);
}

const reboundCues = cuesDueBetween(16, 80).map((cue) => cue.id).join(",");
if (reboundCues !== "prompt-rebound") {
  throw new Error(`unexpected rebound cues: ${reboundCues}`);
}
