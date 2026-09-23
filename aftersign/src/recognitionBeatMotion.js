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

  const originalDialogueTransform = dialogueEl.style.transform;
  const originalDialogueTransition = dialogueEl.style.transition;

  dialogueEl.style.transform = "scale(0.96)";
  dialogueEl.style.transition = "transform 80ms cubic-bezier(0.2, 0, 0, 1)";

  // The sign surface (`.panel`) glints its filter without ever touching
  // inline `style.transition` — the CSS-rule `transition-*` list on
  // `.panel` is contract-owned by the snippet feel-cue (see
  // `--io-recognition-line-reveal-duration-ms`, asserted in
  // io-recognition-dialogue-snippets.spec.ts). Writing the `transition`
  // shorthand inline would clobber that list. Web Animations runs the
  // filter animation off-thread and leaves inline styles untouched.
  const canAnimateSign =
    !!signEl && typeof signEl.animate === "function" && !reducedMotion;
  let signGlint = null;
  if (canAnimateSign) {
    try {
      signGlint = signEl.animate(
        [
          { filter: "brightness(1) drop-shadow(0 0 0 transparent)" },
          { filter: "brightness(1.35) drop-shadow(0 0 10px rgba(255, 233, 173, 0.9))", offset: 0.35 },
          { filter: "brightness(1) drop-shadow(0 0 0 transparent)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "none" },
      );
    } catch { /* animation must never throw upward */ }
  }

  const settleImpl = () => {
    dialogueEl.style.transition = `transform ${reducedMotion ? 0 : 180}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    dialogueEl.style.transform = "scale(1)";
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
    if (signGlint && typeof signGlint.cancel === "function") {
      try { signGlint.cancel(); } catch { /* ignore */ }
    }
    dialogueEl.style.transform = originalDialogueTransform;
    dialogueEl.style.transition = originalDialogueTransition;
  };
}
