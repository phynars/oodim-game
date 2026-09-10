export const AFTERSIGN_FRAME_SAMPLE_TOLERANCE = 0.001;

/**
 * Returns true only after the same sampled value has been observed for the
 * requested number of consecutive frames. E2E harnesses can use this to wait
 * for a semantic visual settle rather than relying on wall-clock delays.
 */
export function hasSettledAcrossFrames(
  samples: readonly number[],
  consecutiveFrames = 2,
): boolean {
  if (consecutiveFrames < 1 || samples.length < consecutiveFrames) {
    return false;
  }

  const settledValue = samples[samples.length - 1];
  return samples
    .slice(-consecutiveFrames)
    .every((sample) => sample === settledValue);
}
