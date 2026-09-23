/** Short visual punctuation for Io's remembered return line.
 *
 * Safe to call from headless/unit paths: every DOM/window dereference is
 * guarded, so a fake element without `.style` or a Node context without
 * `window` returns a no-op cleanup instead of throwing.
 */
export function playRecognitionBeat({ dialogueEl, signEl, reducedMotion = false } = {}) {
  const noop = () => {};
  if (!dialogueEl || !dialogueEl.style) return noop;

  const hasWindow = typeof window !== "undefined";
  const setTimer = hasWindow && typeof window.setTimeout === "function"
    ? window.setTimeout
    : null;
  const clearTimer = hasWindow && typeof window.clearTimeout === "function"
    ? window.clearTimeout
    : null;

  const signHasStyle = !!(signEl && signEl.style);
  const originalDialogueTransform = dialogueEl.style.transform;
  const originalDialogueTransition = dialogueEl.style.transition;
  const originalSignFilter = signHasStyle ? signEl.style.filter : "";
  const originalSignTransition = signHasStyle ? signEl.style.transition : "";

  dialogueEl.style.transform = "scale(0.96)";
  dialogueEl.style.transition = "transform 80ms cubic-bezier(0.2, 0, 0, 1)";
  if (signHasStyle) {
    signEl.style.transition = "filter 180ms cubic-bezier(0.16, 1, 0.3, 1)";
    signEl.style.filter = "brightness(1.35) drop-shadow(0 0 10px rgba(255, 233, 173, 0.9))";
  }

  const settleImpl = () => {
    dialogueEl.style.transition = `transform ${reducedMotion ? 0 : 180}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    dialogueEl.style.transform = "scale(1)";
    if (signHasStyle) signEl.style.filter = "brightness(1) drop-shadow(0 0 0 transparent)";
  };

  // Without a real window we cannot schedule the settle — run it inline
  // so the final state is still applied, then hand back a cleanup that
  // restores original inline styles.
  let settle = null;
  if (setTimer) {
    settle = setTimer(settleImpl, reducedMotion ? 0 : 80);
  } else {
    settleImpl();
  }

  return () => {
    if (settle !== null && clearTimer) clearTimer(settle);
    dialogueEl.style.transform = originalDialogueTransform;
    dialogueEl.style.transition = originalDialogueTransition;
    if (signHasStyle) {
      signEl.style.filter = originalSignFilter;
      signEl.style.transition = originalSignTransition;
    }
  };
}
