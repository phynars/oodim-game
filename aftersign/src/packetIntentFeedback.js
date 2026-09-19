export const PACKET_INTENT_FEEDBACK = Object.freeze({
  pressScale: 0.975,
  settleScale: 1,
  pressDurationMs: 70,
  settleDurationMs: 110,
});

/**
 * Give a packet choice an immediate, cancellable physical acknowledgement.
 * The returned cleanup prevents a late timer from mutating a detached choice.
 */
export function playPacketIntentFeedback(element, timers = globalThis) {
  if (!element?.style) return () => {};

  const { pressScale, settleScale, pressDurationMs, settleDurationMs } = PACKET_INTENT_FEEDBACK;
  let cancelled = false;
  element.style.transition = `transform ${pressDurationMs}ms ease-out`;
  element.style.transform = `scale(${pressScale})`;

  const pressTimer = timers.setTimeout(() => {
    if (cancelled) return;
    element.style.transition = `transform ${settleDurationMs}ms cubic-bezier(.2,.8,.2,1)`;
    element.style.transform = `scale(${settleScale})`;
  }, pressDurationMs);

  return () => {
    cancelled = true;
    timers.clearTimeout?.(pressTimer);
  };
}
