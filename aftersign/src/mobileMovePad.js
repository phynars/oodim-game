// AFTERSIGN mobile movement pad.
// Small, dependency-free runtime helper: turns a touch/mouse drag on a HUD pad
// into the same normalized movement vector the keyboard path already uses.

export const DEFAULT_MOBILE_MOVE_PAD_FEEL = Object.freeze({
  radiusPx: 54,
  deadZonePx: 6,
  releaseMs: 80,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const magnitudeOf = (x, y) => Math.hypot(x, y);

export const normalizeMobileMovePadInput = (
  origin,
  point,
  feel = DEFAULT_MOBILE_MOVE_PAD_FEEL,
) => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = magnitudeOf(dx, dy);

  if (distance <= feel.deadZonePx) {
    return {
      x: 0,
      z: 0,
      knobX: 0,
      knobY: 0,
      magnitude: 0,
    };
  }

  const clampedDistance = Math.min(distance, feel.radiusPx);
  const unitX = distance === 0 ? 0 : dx / distance;
  const unitY = distance === 0 ? 0 : dy / distance;
  const normalizedMagnitude = clamp(
    (clampedDistance - feel.deadZonePx) / (feel.radiusPx - feel.deadZonePx),
    0,
    1,
  );

  return {
    x: Number((unitX * normalizedMagnitude).toFixed(4)),
    // Screen-space down is +y, and the existing movement model already maps
    // +z to backing away / +S. Dragging the thumb upward therefore emits -z.
    z: Number((unitY * normalizedMagnitude).toFixed(4)),
    knobX: Number((unitX * clampedDistance).toFixed(2)),
    knobY: Number((unitY * clampedDistance).toFixed(2)),
    magnitude: Number(normalizedMagnitude.toFixed(4)),
  };
};

export const attachMobileMovePad = ({
  root,
  knob,
  onInput,
  feel = DEFAULT_MOBILE_MOVE_PAD_FEEL,
}) => {
  if (!root || !knob || typeof onInput !== "function") {
    return { detach: () => {}, snapshot: () => ({ active: false }) };
  }

  let activePointerId = null;
  let origin = null;
  let lastInput = { x: 0, z: 0, knobX: 0, knobY: 0, magnitude: 0 };

  const publish = (input, active) => {
    lastInput = input;
    root.dataset.active = String(active);
    root.dataset.magnitude = input.magnitude.toFixed(2);
    knob.style.transform = `translate3d(${input.knobX}px, ${input.knobY}px, 0)`;
    onInput(input.x, input.z, active ? "touch-pad" : "none");
  };

  const pointerPoint = (event) => ({ x: event.clientX, y: event.clientY });

  const pointerDown = (event) => {
    event.preventDefault();
    activePointerId = event.pointerId;
    root.setPointerCapture?.(event.pointerId);
    const rect = root.getBoundingClientRect();
    origin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    publish(normalizeMobileMovePadInput(origin, pointerPoint(event), feel), true);
  };

  const pointerMove = (event) => {
    if (event.pointerId !== activePointerId || !origin) {
      return;
    }
    event.preventDefault();
    publish(normalizeMobileMovePadInput(origin, pointerPoint(event), feel), true);
  };

  const release = (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    event.preventDefault();
    root.releasePointerCapture?.(event.pointerId);
    activePointerId = null;
    origin = null;
    publish({ x: 0, z: 0, knobX: 0, knobY: 0, magnitude: 0 }, false);
  };

  root.addEventListener("pointerdown", pointerDown, { passive: false });
  root.addEventListener("pointermove", pointerMove, { passive: false });
  root.addEventListener("pointerup", release, { passive: false });
  root.addEventListener("pointercancel", release, { passive: false });

  return {
    detach: () => {
      root.removeEventListener("pointerdown", pointerDown);
      root.removeEventListener("pointermove", pointerMove);
      root.removeEventListener("pointerup", release);
      root.removeEventListener("pointercancel", release);
    },
    snapshot: () => ({
      active: activePointerId !== null,
      input: { ...lastInput },
      feel: { ...feel },
    }),
  };
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const checkMobileMovePadFeel = (feel = DEFAULT_MOBILE_MOVE_PAD_FEEL) => {
  assert(feel.radiusPx >= 44, "Mobile move pad needs enough throw for thumb precision");
  assert(feel.deadZonePx > 0 && feel.deadZonePx <= feel.radiusPx * 0.15, "Mobile move pad dead zone must stay small");
  assert(feel.releaseMs <= 100, "Mobile move pad release must feel immediate");

  const center = { x: 100, y: 100 };
  const dead = normalizeMobileMovePadInput(center, { x: center.x + feel.deadZonePx - 1, y: center.y }, feel);
  assert(dead.x === 0 && dead.z === 0, "Dead-zone drift must not move the player");

  const fullRight = normalizeMobileMovePadInput(center, { x: center.x + feel.radiusPx * 2, y: center.y }, feel);
  assert(fullRight.x === 1 && fullRight.z === 0, "Full right throw must normalize to x=1");

  const fullForward = normalizeMobileMovePadInput(center, { x: center.x, y: center.y - feel.radiusPx * 2 }, feel);
  assert(fullForward.x === 0 && fullForward.z === -1, "Upward thumb throw must drive the player forward");

  return true;
};

export const runMobileMovePadChecks = () => checkMobileMovePadFeel();
