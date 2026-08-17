export const RETURN_RECOGNITION_FEEL = Object.freeze({
  shakePx: 1.5,
  holdMs: 90,
  glowMs: 420,
  glowScale: 1.035,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
});

export function playReturnRecognitionFeel(root = document) {
  const stage = root.querySelector('[data-aftersign-stage], main, body');
  const dialogue = root.querySelector('[data-beat="io-return-recognition"], [data-current-beat="io-return-recognition"], [data-dialogue]');

  if (!stage) return false;

  stage.animate(
    [
      { transform: 'translate3d(0, 0, 0)' },
      { transform: `translate3d(${RETURN_RECOGNITION_FEEL.shakePx}px, 0, 0)` },
      { transform: `translate3d(-${RETURN_RECOGNITION_FEEL.shakePx}px, 0, 0)` },
      { transform: 'translate3d(0, 0, 0)' },
    ],
    {
      duration: RETURN_RECOGNITION_FEEL.holdMs,
      easing: 'steps(3, end)',
    },
  );

  if (dialogue) {
    dialogue.animate(
      [
        { filter: 'brightness(1)', transform: 'scale(1)' },
        { filter: 'brightness(1.18)', transform: `scale(${RETURN_RECOGNITION_FEEL.glowScale})` },
        { filter: 'brightness(1)', transform: 'scale(1)' },
      ],
      {
        duration: RETURN_RECOGNITION_FEEL.glowMs,
        easing: RETURN_RECOGNITION_FEEL.easing,
      },
    );
  }

  return true;
}

export function installReturnRecognitionFeel(root = document) {
  const fire = () => playReturnRecognitionFeel(root);

  root.addEventListener('aftersign:return-recognition', fire);

  const target = root.querySelector('[data-beat="io-return-recognition"], [data-current-beat="io-return-recognition"]');
  if (target) fire();

  return () => root.removeEventListener('aftersign:return-recognition', fire);
}
