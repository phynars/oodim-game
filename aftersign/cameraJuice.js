// First-camera-move juice controller for AFTERSIGN.
// Feel target: 18deg yaw over 420ms, cubic-out, 12px touch deadzone.

const DEFAULTS = {
  yawDegrees: 18,
  durationMs: 420,
  touchDeadzonePx: 12,
  arrivalToleranceDegrees: 0.5,
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function cubicOut(t) {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

function shortestYawDelta(fromRadians, toRadians) {
  let delta = toRadians - fromRadians;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

export function createFirstCameraMoveController(camera, options = {}) {
  if (!camera || !camera.rotation) {
    throw new Error('createFirstCameraMoveController requires a camera with rotation');
  }

  const config = { ...DEFAULTS, ...options };
  const targetDeltaRadians = degreesToRadians(config.yawDegrees);
  const toleranceRadians = degreesToRadians(config.arrivalToleranceDegrees);

  let startYaw = camera.rotation.y || 0;
  let targetYaw = startYaw + targetDeltaRadians;
  let elapsedMs = 0;
  let active = false;
  let finished = false;
  let pointerStart = null;
  let lastArrivalErrorDegrees = Math.abs(config.yawDegrees);

  function begin() {
    startYaw = camera.rotation.y || 0;
    targetYaw = startYaw + targetDeltaRadians;
    elapsedMs = 0;
    active = true;
    finished = false;
    lastArrivalErrorDegrees = Math.abs(config.yawDegrees);
  }

  function update(deltaMs) {
    if (!active || finished) {
      return {
        active,
        finished,
        yawDegrees: radiansToDegrees(camera.rotation.y || 0),
        arrivalErrorDegrees: lastArrivalErrorDegrees,
      };
    }

    elapsedMs += Math.max(0, deltaMs || 0);
    const t = clamp01(elapsedMs / config.durationMs);
    const eased = cubicOut(t);
    camera.rotation.y = startYaw + targetDeltaRadians * eased;

    const remaining = Math.abs(shortestYawDelta(camera.rotation.y, targetYaw));
    lastArrivalErrorDegrees = radiansToDegrees(remaining);

    if (t >= 1 || remaining <= toleranceRadians) {
      camera.rotation.y = targetYaw;
      lastArrivalErrorDegrees = 0;
      active = false;
      finished = true;
    }

    return {
      active,
      finished,
      progress: eased,
      yawDegrees: radiansToDegrees(camera.rotation.y - startYaw),
      arrivalErrorDegrees: lastArrivalErrorDegrees,
    };
  }

  function onPointerDown(event) {
    pointerStart = {
      x: event.clientX ?? event.pageX ?? 0,
      y: event.clientY ?? event.pageY ?? 0,
    };
  }

  function onPointerUp(event) {
    if (!pointerStart || active || finished) return false;

    const x = event.clientX ?? event.pageX ?? 0;
    const y = event.clientY ?? event.pageY ?? 0;
    const dx = x - pointerStart.x;
    const dy = y - pointerStart.y;
    pointerStart = null;

    if (Math.hypot(dx, dy) < config.touchDeadzonePx) {
      return false;
    }

    begin();
    return true;
  }

  return {
    begin,
    update,
    onPointerDown,
    onPointerUp,
    get active() {
      return active;
    },
    get finished() {
      return finished;
    },
    get arrivalErrorDegrees() {
      return lastArrivalErrorDegrees;
    },
    config,
  };
}

export const firstCameraMoveFeel = Object.freeze({ ...DEFAULTS, easing: 'cubic-out' });
