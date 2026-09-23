/**
 * Applies the short physical punctuation for Io's returning-memory line.
 * Call after the recognition line is rendered; the returned cleanup restores
 * inline styles when the dialogue surface is replaced.
 */
export function playRecognitionBeat({
  dialogueEl,
  signEl,
  reducedMotion = false,
}) {
  if (!dialogueEl) return () => {};

  const originalDialogueTransform = dialogueEl.style.transform;
  const originalDialogueTransition = dialogueEl.style.transition;
  const originalSignFilter = signEl?.style.filter ?? '';
  const originalSignTransition = signEl?.style.transition ?? '';

  // The recognition arrives as a tiny inhale, then settles in 180ms.
  dialogueEl.style.transform = 'scale(0.96)';
  dialogueEl.style.transition = 'transform 80ms cubic-bezier(0.2, 0, 0, 1)';

  if (signEl) {
    signEl.style.transition = 'filter 180ms cubic-bezier(0.16, 1, 0.3, 1)';
    signEl.style.filter = 'brightness(1.35) drop-shadow(0 0 10px rgba(255, 233, 173, 0.9))';
  }

  const settle = window.setTimeout(() => {
    dialogueEl.style.transition = `transform ${reducedMotion ? 0 : 180}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    dialogueEl.style.transform = 'scale(1)';
    if (signEl) signEl.style.filter = 'brightness(1) drop-shadow(0 0 0 transparent)';
  }, reducedMotion ? 0 : 80);

  return () => {
    window.clearTimeout(settle);
    dialogueEl.style.transform = originalDialogueTransform;
    dialogueEl.style.transition = originalDialogueTransition;
    if (signEl) {
      signEl.style.filter = originalSignFilter;
      signEl.style.transition = originalSignTransition;
    }
  };
}
