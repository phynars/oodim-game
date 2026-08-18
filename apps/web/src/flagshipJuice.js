// Flagship feel constants for touch-driven AFTERSIGN beats.
// These values are intentionally small and mobile-first: enough feedback to
// make a tap legible without stealing time from the dialogue loop.

export const FLAGSHIP_TAP_CONFIRM_FEEL = Object.freeze({
  pressScale: 0.96,
  releaseScale: 1.0,
  pressMs: 72,
  releaseMs: 140,
  releaseEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  glowPx: 10,
  glowMs: 180,
  shakePx: 2,
  shakeMs: 90,
});

export function applyFlagshipTapConfirmFeel(element) {
  if (!element) return () => {};

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let releaseTimer = 0;
  let glowTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(releaseTimer);
    window.clearTimeout(glowTimer);
  };

  const press = () => {
    clearTimers();
    element.style.transition = `transform ${FLAGSHIP_TAP_CONFIRM_FEEL.pressMs}ms ease-out, box-shadow ${FLAGSHIP_TAP_CONFIRM_FEEL.glowMs}ms ease-out`;
    element.style.transform = reduceMotion
      ? 'none'
      : `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.pressScale})`;
    element.style.boxShadow = `0 0 ${FLAGSHIP_TAP_CONFIRM_FEEL.glowPx}px rgba(122, 231, 255, 0.56)`;
  };

  const release = () => {
    element.style.transition = `transform ${FLAGSHIP_TAP_CONFIRM_FEEL.releaseMs}ms ${FLAGSHIP_TAP_CONFIRM_FEEL.releaseEasing}, box-shadow ${FLAGSHIP_TAP_CONFIRM_FEEL.glowMs}ms ease-out`;
    element.style.transform = reduceMotion
      ? 'none'
      : `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.releaseScale})`;
    glowTimer = window.setTimeout(() => {
      element.style.boxShadow = '';
    }, FLAGSHIP_TAP_CONFIRM_FEEL.glowMs);
  };

  element.addEventListener('pointerdown', press);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointerleave', release);

  return () => {
    clearTimers();
    element.removeEventListener('pointerdown', press);
    element.removeEventListener('pointerup', release);
    element.removeEventListener('pointercancel', release);
    element.removeEventListener('pointerleave', release);
  };
}
