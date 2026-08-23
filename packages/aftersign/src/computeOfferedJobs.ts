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
 * Shape the harness-side player memory carries — `playerName` and
 * `interactionCount` — mapped down into the two axes
 * `computeOfferedJobs` reads. Kept as a separate helper (not a
 * `computeOfferedJobs` overload) so consumers that DO know their
 * `trustPosture` / `priorOutcome` can pass them directly; consumers
 * that only know the harness shape can pipe through here.
 *
 * First-pass mapping (deliberately narrow — expand as the surface
 * learns more axes):
 *   • `interactionCount >= 1` → `priorOutcome: "completed"` (a returning
 *     session only fires when the player finished a prior packet-return
 *     flow, so the count implies a completed prior loop).
 *   • Anything else falls through to defaults — the primitive returns
 *     `[SAFE_DEFAULT_JOB_ID]`.
 *
 * `trustPosture` is intentionally NOT derived from the harness bag
 * yet: the harness doesn't carry a trust axis today. When the
 * surface begins tracking one, extend the mapping here and add a
 * consumer test alongside — don't fabricate it out of `playerName`.
 */
export interface OfferedJobsPlayerMemoryInput {
  playerName?: string;
  interactionCount?: number;
}

export function deriveOfferedJobsPlayerMemory(
  input: OfferedJobsPlayerMemoryInput | null | undefined,
): PlayerMemory | undefined {
  if (!input) {
    return undefined;
  }
  const memory: PlayerMemory = {};
  if (
    typeof input.interactionCount === "number" &&
    Number.isFinite(input.interactionCount) &&
    input.interactionCount >= 1
  ) {
    memory.priorOutcome = "completed";
  }
  return memory;
}

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
