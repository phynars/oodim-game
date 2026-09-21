const DEFAULT_DURATION_MS = 120;
const DEFAULT_DISTANCE_PX = 2;

/**
 * A short release settle for the packet choice after a pointer leaves its
 * target. This is deliberately transform-only: it cannot trigger layout
 * during a tap-driven story beat.
 */
export function getPacketReleaseForgivenessFrame(
  elapsedMs,
  {
    durationMs = DEFAULT_DURATION_MS,
    distancePx = DEFAULT_DISTANCE_PX,
  } = {},
) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return { complete: false, translateY: -distancePx };
  }

  const progress = Math.min(elapsedMs / durationMs, 1);
  const eased = 1 - (1 - progress) * (1 - progress);

  return {
    complete: progress === 1,
    translateY: -distancePx * (1 - eased),
  };
}

/**
 * Restores the packet choice without cancelling the player's completed tap.
 * The callback remains useful for the served renderer, while the pure frame
 * function makes the timing regressible without a DOM.
 */
export function playPacketReleaseForgiveness(
  element,
  { durationMs = DEFAULT_DURATION_MS, distancePx = DEFAULT_DISTANCE_PX } = {},
) {
  if (!element || typeof requestAnimationFrame !== "function") return;

  const start = performance.now();
  const tick = (now) => {
    const frame = getPacketReleaseForgivenessFrame(now - start, {
      durationMs,
      distancePx,
    });
    element.style.transform = `translateY(${frame.translateY}px)`;

    if (!frame.complete) {
      requestAnimationFrame(tick);
      return;
    }

    element.style.transform = "";
  };

  requestAnimationFrame(tick);
}
