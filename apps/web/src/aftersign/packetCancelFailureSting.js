/**
 * Shared, reduced-motion-safe failure acknowledgement for an interrupted packet gesture.
 *
 * The surface provides the rendered packet element. This module deliberately keeps the
 * acknowledgement visible when motion is reduced while removing positional motion.
 */
export const PACKET_CANCEL_FAILURE_STING = Object.freeze({
  flashMs: 180,
  shakePx: 6,
  shakeMs: 180,
  easing: 'cubic-bezier(.22, 1, .36, 1)',
});

export function playPacketCancelFailureSting(element, { reducedMotion = false } = {}) {
  if (!element) return;

  const { flashMs, shakePx, shakeMs, easing } = PACKET_CANCEL_FAILURE_STING;
  element.animate(
    reducedMotion
      ? [
          { filter: 'brightness(1)', offset: 0 },
          { filter: 'brightness(1.32)', offset: 0.35 },
          { filter: 'brightness(1)', offset: 1 },
        ]
      : [
          { transform: 'translateX(0)', filter: 'brightness(1)', offset: 0 },
          { transform: `translateX(${-shakePx}px)`, filter: 'brightness(1.32)', offset: 0.24 },
          { transform: `translateX(${shakePx}px)`, filter: 'brightness(1.18)', offset: 0.52 },
          { transform: 'translateX(0)', filter: 'brightness(1)', offset: 1 },
        ],
    {
      duration: reducedMotion ? flashMs : shakeMs,
      easing,
      fill: 'none',
    },
  );
}
