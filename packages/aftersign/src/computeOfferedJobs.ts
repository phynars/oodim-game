export type TrustPosture = "trusted-courier" | "unknown" | "guarded";
export type PriorOutcome = "completed" | "failed" | "unknown";

/** The durable player-history axes that vary the offered job list. */
export interface PlayerMemory {
  trustPosture?: TrustPosture;
  priorOutcome?: PriorOutcome;
  /**
   * A durable, mechanically-felt wax-seal debt carried over from a
   * prior loop where the player opened / mishandled a sealed packet.
   * When present and `> 0` — and neither a trusted-courier nor a
   * completed-loop history overrides it — the offer list swaps to
   * the debt-repair route (a longer, lower-payoff run whose only
   * purpose is to zero out the debt). This is the third mechanical
   * axis the M-LOOP boundary contract covers: id AND route-risk
   * diverge from every other branch, so `ioJobOffersDiverge` fires
   * at the fingerprint layer, not the label layer.
   */
  debtHeld?: number;
}

/** One player-visible job offer, authored alongside its selection rule. */
export interface IoJobOffer {
  readonly id: string;
  readonly label: string;
  readonly routeRisk: "low" | "medium" | "high";
  readonly requiresMemory: boolean;
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
export const DEBT_HELD_JOB_IDS = ["job-wax-debt-repair"] as const;

const OFFER_BY_ID: Readonly<Record<string, IoJobOffer>> = {
  [SAFE_DEFAULT_JOB_ID]: {
    id: SAFE_DEFAULT_JOB_ID,
    label: "Safe delivery",
    routeRisk: "low",
    requiresMemory: false,
  },
  "job-sealed-return": {
    id: "job-sealed-return",
    label: "Sealed return",
    routeRisk: "medium",
    requiresMemory: true,
  },
  "job-private-ledger": {
    id: "job-private-ledger",
    label: "Private ledger",
    routeRisk: "high",
    requiresMemory: true,
  },
  "job-night-transfer": {
    id: "job-night-transfer",
    label: "Night transfer",
    routeRisk: "medium",
    requiresMemory: true,
  },
  "job-signed-receipt": {
    id: "job-signed-receipt",
    label: "Signed receipt",
    routeRisk: "low",
    requiresMemory: true,
  },
  "job-low-risk-errand": {
    id: "job-low-risk-errand",
    label: "Low-risk errand",
    routeRisk: "low",
    requiresMemory: true,
  },
  "job-redemption-route": {
    id: "job-redemption-route",
    label: "Redemption route",
    routeRisk: "high",
    requiresMemory: true,
  },
  "job-wax-debt-repair": {
    id: "job-wax-debt-repair",
    label: "Wax-debt repair run",
    routeRisk: "medium",
    requiresMemory: true,
  },
};

export interface OfferedJobsPlayerMemoryInput {
  playerName?: string;
  interactionCount?: number;
}

export function deriveOfferedJobsPlayerMemory(
  input: OfferedJobsPlayerMemoryInput | null | undefined,
): PlayerMemory | undefined {
  if (!input) return undefined;
  return typeof input.interactionCount === "number"
    && Number.isFinite(input.interactionCount)
    && input.interactionCount >= 1
    ? { priorOutcome: "completed" }
    : {};
}

function selectedJobIds(memory?: PlayerMemory): readonly string[] {
  if (memory?.trustPosture === "trusted-courier") return TRUSTED_COURIER_JOB_IDS;
  if (memory?.priorOutcome === "completed") return COMPLETED_JOB_IDS;
  if (memory?.trustPosture === "guarded") return GUARDED_JOB_IDS;
  if (memory?.priorOutcome === "failed") return FAILED_JOB_IDS;
  // Debt-held saves route through the repair run BEFORE the safe
  // default. Trusted / completed histories above already override
  // it: a proven courier isn't demoted to debt-repair, and a
  // player who cleared the last loop isn't punished for a stale
  // wax debt. Guarded / failed histories also outrank it because
  // those axes describe a stronger memory signal than "carried a
  // wax debt in".
  if (typeof memory?.debtHeld === "number" && memory.debtHeld > 0) {
    return DEBT_HELD_JOB_IDS;
  }
  return [SAFE_DEFAULT_JOB_ID];
}

/** Canonical labelled, risk-aware M-LOOP offer selector. */
export function selectIoJobOffers(memory?: PlayerMemory): IoJobOffer[] {
  return selectedJobIds(memory).map((id) => OFFER_BY_ID[id]);
}

/** Legacy id projection kept for existing snapshot consumers. */
export function computeOfferedJobs(memory?: PlayerMemory): string[] {
  return selectIoJobOffers(memory).map((offer) => offer.id);
}
