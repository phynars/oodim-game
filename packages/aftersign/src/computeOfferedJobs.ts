export type TrustPosture = "trusted-courier" | "unknown" | "guarded";
export type PriorOutcome = "completed" | "failed" | "unknown";

/**
 * The small, serialisable slice of player history used to vary job offers.
 * All fields are optional so callers can safely pass an absent or partial save.
 */
export interface PlayerMemory {
  trustPosture?: TrustPosture;
  priorOutcome?: PriorOutcome;
}

export const SAFE_DEFAULT_JOB_ID = "job-safe-delivery";
export const TRUSTED_COURIER_JOB_IDS = [
  "job-sealed-return",
  "job-private-ledger",
] as const;
export const COMPLETED_JOB_IDS = [
  "job-night-transfer",
  "job-signed-receipt",
] as const;
export const GUARDED_JOB_IDS = ["job-low-risk-errand"] as const;
export const FAILED_JOB_IDS = ["job-redemption-route"] as const;

/**
 * Selects deterministic job IDs from the player's remembered posture and outcome.
 * It never mutates the supplied memory or retains state between calls.
 */
export function computeOfferedJobs(memory?: PlayerMemory): string[] {
  if (memory?.trustPosture === "trusted-courier") {
    return [...TRUSTED_COURIER_JOB_IDS];
  }

  if (memory?.priorOutcome === "completed") {
    return [...COMPLETED_JOB_IDS];
  }

  if (memory?.trustPosture === "guarded") {
    return [...GUARDED_JOB_IDS];
  }

  if (memory?.priorOutcome === "failed") {
    return [...FAILED_JOB_IDS];
  }

  return [SAFE_DEFAULT_JOB_ID];
}
