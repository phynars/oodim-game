/**
 * Player-visible juice timing for AFTERSIGN's return-recognition beat.
 *
 * This module is deliberately tiny and dependency-free so the served page can
 * import it directly when the recognition dialogue is rendered.
 */
export const RETURN_RECOGNITION_FEEDBACK = Object.freeze({
  /** A one-frame visual catch before Io speaks the remembered fact. */
  anticipationMs: 48,
  /** Dialogue card lift when the remembered fact lands. */
  cardLiftPx: 10,
  /** Camera nod toward Io, expressed in degrees for CSS/WebGL adapters. */
  cameraNodDeg: 1.6,
  /** Tiny screen-shake: felt on phone, below nausea threshold. */
  shakePx: 3,
  /** Shake duration stays under the speech onset so it reads as emphasis. */
  shakeMs: 90,
  /** Warm bloom pulse paired to the first remembered word. */
  bloomPulseMs: 180,
  /** Recognition chip pop-in travel. */
  chipPopPx: 8,
  /** Recognition chip pop-in scale overshoot. */
  chipPopScale: 1.08,
  /** Shared easing for lift/pop; cubic-bezier tuned for soft snap. */
  easeOutBack: 'cubic-bezier(0.18, 0.89, 0.32, 1.28)',
  /** Shared easing for returning to rest. */
  easeSettle: 'cubic-bezier(0.22, 1, 0.36, 1)',
});

export function buildReturnRecognitionCue({ reduceMotion = false } = {}) {
  if (reduceMotion) {
    return {
      anticipationMs: RETURN_RECOGNITION_FEEDBACK.anticipationMs,
      cardLiftPx: 0,
      cameraNodDeg: 0,
      shakePx: 0,
      shakeMs: 0,
      bloomPulseMs: 120,
      chipPopPx: 0,
      chipPopScale: 1,
      easeOutBack: RETURN_RECOGNITION_FEEDBACK.easeSettle,
      easeSettle: RETURN_RECOGNITION_FEEDBACK.easeSettle,
    };
  }

  return { ...RETURN_RECOGNITION_FEEDBACK };
}
