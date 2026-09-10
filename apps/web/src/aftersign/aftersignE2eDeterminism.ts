/**
 * Aftersign e2e determinism helpers.
 *
 * The aftersign Playwright suite samples live WebGL / CSS values as the
 * animation envelope lands. Two failure modes have historically flaked
 * hosted CI (see #1704):
 *
 *   1. Precision race — a `toBeCloseTo(0.18, 3)` assertion samples the
 *      vignette opacity mid-transition and receives `0.179414`. The
 *      transition is settling toward the authored terminus but hasn't
 *      reached it within the frame budget the test allotted.
 *   2. Residual-shake race — a `toBe(0)` assertion on a lateral-shake
 *      channel receives `2` because the reduced-motion CDP emulation
 *      hadn't been applied before the sampled frame, so the envelope
 *      still had wobble in it.
 *
 * Both are the same shape: sample a live number, compare with an
 * expected terminus, flake when the sample lands mid-flight. The fix
 * is to (a) tolerate float jitter on the settle check with the SAME
 * tolerance the downstream assertion uses, and (b) require the value
 * to be stable across consecutive frames before we sample — so the
 * assertion runs against a settled terminus, not a drifting reading.
 *
 * `AFTERSIGN_FRAME_SAMPLE_TOLERANCE` is the shared jitter budget:
 * `toBeCloseTo(x, 3)` in Jest/Playwright means `|received - x| < 0.0005`,
 * so a settle tolerance of `0.0005` guarantees any value that passes
 * settle also passes the assertion. Callers passing a stricter
 * assertion (e.g. precision 4) can override.
 */

/**
 * Default numeric tolerance for aftersign frame sampling. Matches
 * `toBeCloseTo(_, 3)` — i.e. `|actual - expected| < 0.0005`. See the
 * module comment above for why this specific number.
 */
export const AFTERSIGN_FRAME_SAMPLE_TOLERANCE = 0.0005;

/**
 * True when the last `consecutiveFrames` samples are all within
 * `tolerance` of the final sample. Use this to wait for a live value
 * to stop drifting before you assert on it — the settle threshold
 * MUST be `<=` the tolerance the downstream `toBeCloseTo` will use,
 * or you can settle at a value the assertion then rejects.
 *
 * Uses `Math.abs(diff) <= tolerance` (NOT strict `===`) so it survives
 * the float jitter that motivated #1704 — a `0.179414` sample settling
 * toward an authored `0.18` terminus passes settle at tolerance
 * `0.0005` iff its neighbors are within `0.0005` of it, which is the
 * same tolerance the `toBeCloseTo(0.18, 3)` assertion enforces.
 */
export function hasSettledAcrossFrames(
  samples: readonly number[],
  consecutiveFrames = 3,
  tolerance: number = AFTERSIGN_FRAME_SAMPLE_TOLERANCE,
): boolean {
  if (consecutiveFrames < 2 || samples.length < consecutiveFrames) {
    return false;
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return false;
  }
  const window = samples.slice(-consecutiveFrames);
  const anchor = window[window.length - 1];
  if (!Number.isFinite(anchor)) {
    return false;
  }
  return window.every(
    (sample) =>
      Number.isFinite(sample) && Math.abs(sample - anchor) <= tolerance,
  );
}

/**
 * True when `sample` is within `tolerance` of `expected`. Same
 * semantics as `toBeCloseTo(expected, 3)` when tolerance is the
 * default. Exported so the settle check and the final assertion
 * share ONE comparison function — if the tolerance ever needs to
 * change, both sides move together.
 */
export function isWithinFrameSampleTolerance(
  sample: number,
  expected: number,
  tolerance: number = AFTERSIGN_FRAME_SAMPLE_TOLERANCE,
): boolean {
  if (!Number.isFinite(sample) || !Number.isFinite(expected)) return false;
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;
  return Math.abs(sample - expected) <= tolerance;
}
