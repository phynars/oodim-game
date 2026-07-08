export const FIRST_CAMERA_MOVE = Object.freeze({
  durationMs: 900,
  easing: "easeOutCubic",
  start: Object.freeze({
    x: 0,
    y: 2.58,
    z: 9.2,
    rollDeg: -0.85,
  }),
  end: Object.freeze({
    x: 0,
    y: 2.25,
    z: 7.6,
    rollDeg: 0,
  }),
  settle: Object.freeze({
    bouncePx: 6,
    bounceFrames: 8,
  }),
  parallax: Object.freeze({
    playerTrackX: 0.12,
    playerTrackZ: 0.12,
  }),
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const lerp = (from, to, amount) => from + (to - from) * amount;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

const toRadians = (deg) => (deg * Math.PI) / 180;

export const sampleFirstCameraMove = (elapsedMs, profile = FIRST_CAMERA_MOVE) => {
  const progress = clamp01(elapsedMs / profile.durationMs);
  const eased = easeOutCubic(progress);

  const x = lerp(profile.start.x, profile.end.x, eased);
  const y = lerp(profile.start.y, profile.end.y, eased);
  const z = lerp(profile.start.z, profile.end.z, eased);
  const rollDeg = lerp(profile.start.rollDeg, profile.end.rollDeg, eased);

  const settleFrames = Math.max(1, profile.settle.bounceFrames);
  const settleWindowStart = Math.max(0, profile.durationMs - settleFrames * (1000 / 60));
  const settleProgress = clamp01((elapsedMs - settleWindowStart) / (profile.durationMs - settleWindowStart || 1));
  const settleOffsetPx = Math.round(Math.sin(settleProgress * Math.PI) * profile.settle.bouncePx);

  return Object.freeze({
    progress,
    eased,
    x,
    y,
    z,
    rollDeg,
    rollRadians: toRadians(rollDeg),
    settleOffsetPx,
    done: progress >= 1,
  });
};

export const createFirstCameraMoveController = (profile = FIRST_CAMERA_MOVE) => {
  let startedAt = null;

  return Object.freeze({
    profile,
    start(nowMs) {
      startedAt = nowMs;
      return sampleFirstCameraMove(0, profile);
    },
    sample(nowMs) {
      if (startedAt === null) {
        return sampleFirstCameraMove(0, profile);
      }
      return sampleFirstCameraMove(nowMs - startedAt, profile);
    },
    reset() {
      startedAt = null;
      return sampleFirstCameraMove(0, profile);
    },
    isActive() {
      if (startedAt === null) return false;
      return sampleFirstCameraMove(performance.now() - startedAt, profile).done === false;
    },
  });
};

export const assertFirstCameraMoveFeelContract = (profile = FIRST_CAMERA_MOVE) => {
  const firstFrame = sampleFirstCameraMove(0, profile);
  const halfBeat = sampleFirstCameraMove(profile.durationMs / 2, profile);
  const finalFrame = sampleFirstCameraMove(profile.durationMs, profile);
  // Sample the middle of the settle window — where sin(π·0.5) = 1, so the
  // offset should be exactly profile.settle.bouncePx (rounded). If the tick
  // in index.html is wired to settleOffsetPx, this value is what the camera
  // actually gets nudged by.
  const settleFrameMs = 1000 / 60;
  const settleWindowStart = Math.max(0, profile.durationMs - profile.settle.bounceFrames * settleFrameMs);
  const settleMidMs = settleWindowStart + (profile.durationMs - settleWindowStart) / 2;
  const settleMid = sampleFirstCameraMove(settleMidMs, profile);

  const startsWide = firstFrame.z > profile.end.z && firstFrame.y > profile.end.y;
  const convergesByHalf = halfBeat.progress >= 0.49 && halfBeat.progress <= 0.51;
  const easesIntoSettle = finalFrame.done && Math.abs(finalFrame.rollDeg - profile.end.rollDeg) <= 0.05;
  // Guards against the "declared bounce is dead code" failure mode: settle
  // must be zero at t=0 and t=duration, and non-zero and reach bouncePx in
  // between. If the tick ever stops reading settleOffsetPx, this still
  // passes — but see also the tick assertion in index.html that consumes it.
  const settleAtStartIsZero = firstFrame.settleOffsetPx === 0;
  const settleAtEndIsZero = finalFrame.settleOffsetPx === 0;
  const settleMidHitsBounce = settleMid.settleOffsetPx === profile.settle.bouncePx;
  const settleIsAlive = settleAtStartIsZero && settleAtEndIsZero && settleMidHitsBounce;

  return Object.freeze({
    passed: startsWide && convergesByHalf && easesIntoSettle && settleIsAlive,
    startsWide,
    convergesByHalf,
    easesIntoSettle,
    settleIsAlive,
    settleAtStartIsZero,
    settleAtEndIsZero,
    settleMidHitsBounce,
    settleMidOffsetPx: settleMid.settleOffsetPx,
    durationMs: profile.durationMs,
    startZ: profile.start.z,
    endZ: profile.end.z,
    settleBouncePx: profile.settle.bouncePx,
    settleFrames: profile.settle.bounceFrames,
  });
};
