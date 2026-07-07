export type HoldProgress = {
  elapsedMs: number;
  progress01: number;
  committed: boolean;
};

export type HoldCommitConfig = {
  /**
   * Milliseconds a hold must be sustained before commit fires.
   * Tuned for intentional, cancelable interaction (default: 750ms).
   */
  thresholdMs: number;
  /**
   * Lower bound used by assertions when tuning interaction feel.
   */
  minThresholdMs: number;
  /**
   * Upper bound used by assertions when tuning interaction feel.
   */
  maxThresholdMs: number;
};

export const DEFAULT_HOLD_COMMIT_CONFIG: HoldCommitConfig = {
  thresholdMs: 750,
  minThresholdMs: 650,
  maxThresholdMs: 850,
};

export function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function isThresholdInSpec(config: HoldCommitConfig): boolean {
  return (
    config.thresholdMs >= config.minThresholdMs &&
    config.thresholdMs <= config.maxThresholdMs
  );
}

/**
 * Advances hold-to-commit state for one simulation step.
 *
 * Rules:
 * - press starts/continues accumulation.
 * - release resets elapsed time immediately.
 * - commit flips true on the first tick elapsed >= threshold.
 */
export function advanceHoldProgress(
  previous: HoldProgress,
  isPressed: boolean,
  dtMs: number,
  config: HoldCommitConfig = DEFAULT_HOLD_COMMIT_CONFIG,
): HoldProgress {
  if (!isPressed) {
    return { elapsedMs: 0, progress01: 0, committed: false };
  }

  const elapsedMs = Math.max(0, previous.elapsedMs + Math.max(0, dtMs));
  const progress01 = clamp01(elapsedMs / Math.max(1, config.thresholdMs));
  const committed = elapsedMs >= config.thresholdMs;

  return {
    elapsedMs,
    progress01,
    committed,
  };
}

export function createInitialHoldProgress(): HoldProgress {
  return {
    elapsedMs: 0,
    progress01: 0,
    committed: false,
  };
}
