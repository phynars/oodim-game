/**
 * Applies the short physical punctuation for Io's returning-memory line.
 *
 * Call after the recognition line is rendered; the returned cleanup restores
 * inline styles and cancels the pending settle when the dialogue surface is
 * replaced. Safe on headless/unit paths — a fake element without `.style` or
 * a Node context without `window` returns a no-op cleanup instead of throwing.
 */
export function playRecognitionBeat({
  dialogueEl,
  signEl,
  reducedMotion = false,
} = {}) {
  const noop = () => {};
  if (!dialogueEl || !dialogueEl.style) return noop;

  const hasWindow = typeof window !== 'undefined';
  const setTimer =
    hasWindow && typeof window.setTimeout === 'function' ? window.setTimeout : null;
  const clearTimer =
    hasWindow && typeof window.clearTimeout === 'function' ? window.clearTimeout : null;

  const originalDialogueTransform = dialogueEl.style.transform;
  const originalDialogueTransition = dialogueEl.style.transition;

  // The recognition arrives as a tiny inhale, then settles in 180ms.
  dialogueEl.style.transform = 'scale(0.96)';
  dialogueEl.style.transition = 'transform 80ms cubic-bezier(0.2, 0, 0, 1)';

  // The sign surface (`.panel`) glints its filter via Web Animations so
  // we never touch its inline `style.transition` shorthand — the
  // CSS-rule transition list on `.panel` is contract-owned by the
  // snippet feel-cue (`--io-recognition-line-reveal-duration-ms`,
  // asserted in io-recognition-dialogue-snippets.spec.ts). Writing the
  // `transition` shorthand inline would clobber `transition-duration`.
  const canAnimateSign =
    !!signEl && typeof signEl.animate === 'function' && !reducedMotion;
  let signGlint = null;
  if (canAnimateSign) {
    try {
      signGlint = signEl.animate(
        [
          { filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
          {
            filter:
              'brightness(1.35) drop-shadow(0 0 10px rgba(255, 233, 173, 0.9))',
            offset: 0.35,
          },
          { filter: 'brightness(1) drop-shadow(0 0 0 transparent)' },
        ],
        {
          duration: 260,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'none',
        },
      );
    } catch {
      /* animation must never throw upward */
    }
  }

  const settleImpl = () => {
    dialogueEl.style.transition = `transform ${reducedMotion ? 0 : 180}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    dialogueEl.style.transform = 'scale(1)';
  };

  let settle = null;
  if (setTimer) {
    settle = setTimer(settleImpl, reducedMotion ? 0 : 80);
  } else {
    settleImpl();
  }

  return () => {
    if (settle !== null && clearTimer) clearTimer(settle);
    if (signGlint && typeof signGlint.cancel === 'function') {
      try {
        signGlint.cancel();
      } catch {
        /* ignore */
      }
    }
    dialogueEl.style.transform = originalDialogueTransform;
    dialogueEl.style.transition = originalDialogueTransition;
  };
}
