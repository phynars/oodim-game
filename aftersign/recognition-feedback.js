/**
 * A short, DOM-only recognition accent for the served dialogue layer.
 * Call after a persisted-memory line has been rendered.
 */
export function playRecognitionFeedback(element, { reducedMotion = false } = {}) {
  if (!element || reducedMotion) return;

  element.animate(
    [
      { transform: 'translateY(3px) scale(0.985)', filter: 'brightness(1)' },
      { transform: 'translateY(-2px) scale(1.018)', filter: 'brightness(1.35)' },
      { transform: 'translateY(0) scale(1)', filter: 'brightness(1)' },
    ],
    {
      duration: 360,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'both',
    },
  );

  const flash = document.createElement('div');
  flash.setAttribute('aria-hidden', 'true');
  Object.assign(flash.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    background: 'radial-gradient(circle at 50% 46%, rgba(255, 244, 205, 0.22), rgba(255, 244, 205, 0) 52%)',
    opacity: '0',
  });
  document.body.append(flash);
  flash.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.28 }, { opacity: 0 }],
    { duration: 360, easing: 'ease-out' },
  ).finished.finally(() => flash.remove());
}
