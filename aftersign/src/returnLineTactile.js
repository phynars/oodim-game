export const RETURN_LINE_TACTILE = Object.freeze({
  acknowledgeMs: 180,
  shakePx: 4,
  shakeCycles: 2,
  reducedMotionShakePx: 0,
});

export function getReturnLineTactileFeedback({ reducedMotion = false } = {}) {
  return {
    acknowledgeMs: RETURN_LINE_TACTILE.acknowledgeMs,
    shakePx: reducedMotion ? RETURN_LINE_TACTILE.reducedMotionShakePx : RETURN_LINE_TACTILE.shakePx,
    shakeCycles: reducedMotion ? 0 : RETURN_LINE_TACTILE.shakeCycles,
  };
}
