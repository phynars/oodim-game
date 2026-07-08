export type InteractionConfirmFeelSpec = {
  /** Delay from input (pointerup/keydown) to first visible feedback frame. */
  onsetMs: number;
  /** Peak camera micro-bump in world-space degrees. */
  cameraNodDeg: number;
  /** Peak world-space screen shake in CSS pixels at 1x scale. */
  shakePx: number;
  /** Total visual envelope length from onset to settle. */
  envelopeMs: number;
  /** Primary easing curve for the pop in phase. */
  easeOut: [number, number, number, number];
  /** Return easing curve for the settle phase. */
  easeInOut: [number, number, number, number];
  /** Audio lead/lag against first visual frame (+ means audio starts later). */
  avOffsetMs: number;
};

/**
 * AFTERSIGN flagship touchpoint spec: interaction confirm pulse.
 *
 * Acceptance targets (measurable):
 * - onset <= 90ms from input to first non-idle visual frame
 * - camera nod reaches 0.9deg ±0.1deg on frame 3-5 @60fps
 * - shake peak reaches 3px ±0.5px and settles to 0 by <= 260ms
 * - visual envelope finishes by <= 280ms
 * - audio transient starts within ±16ms of first visual frame
 */
export const INTERACTION_CONFIRM_FEEL_SPEC: InteractionConfirmFeelSpec = {
  onsetMs: 90,
  cameraNodDeg: 0.9,
  shakePx: 3,
  envelopeMs: 280,
  // Snappy pop: cubic-bezier(0.22, 1, 0.36, 1)
  easeOut: [0.22, 1, 0.36, 1],
  // Gentle settle: cubic-bezier(0.33, 1, 0.68, 1)
  easeInOut: [0.33, 1, 0.68, 1],
  avOffsetMs: 0,
};

export function withinConfirmFeelTolerance(measured: {
  onsetMs: number;
  cameraNodDeg: number;
  shakePx: number;
  envelopeMs: number;
  avOffsetMs: number;
}): boolean {
  return (
    measured.onsetMs <= INTERACTION_CONFIRM_FEEL_SPEC.onsetMs &&
    measured.cameraNodDeg >= INTERACTION_CONFIRM_FEEL_SPEC.cameraNodDeg - 0.1 &&
    measured.cameraNodDeg <= INTERACTION_CONFIRM_FEEL_SPEC.cameraNodDeg + 0.1 &&
    measured.shakePx >= INTERACTION_CONFIRM_FEEL_SPEC.shakePx - 0.5 &&
    measured.shakePx <= INTERACTION_CONFIRM_FEEL_SPEC.shakePx + 0.5 &&
    measured.envelopeMs <= INTERACTION_CONFIRM_FEEL_SPEC.envelopeMs &&
    Math.abs(measured.avOffsetMs - INTERACTION_CONFIRM_FEEL_SPEC.avOffsetMs) <= 16
  );
}
