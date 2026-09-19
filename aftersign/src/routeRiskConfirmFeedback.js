/**
 * One-shot confirmation feedback for a committed route-risk choice.
 *
 * The route buttons should acknowledge the tap before the next dialogue
 * render can replace them. This stays DOM-local so it is safe to call from
 * the served page without holding scene state.
 */
export function playRouteRiskConfirmFeedback(element, {
  durationMs = 180,
  liftPx = 4,
  peakScale = 1.025,
} = {}) {
  if (!element || typeof element.animate !== 'function') return null;

  return element.animate([
    { transform: 'translateY(0) scale(1)', offset: 0 },
    { transform: `translateY(${-liftPx}px) scale(${peakScale})`, offset: 0.42 },
    { transform: 'translateY(0) scale(1)', offset: 1 },
  ], {
    duration: durationMs,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'none',
  });
}
