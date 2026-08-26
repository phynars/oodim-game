// M-LOOP divergence FEEL primitive — pure job-offer selector keyed
// off the packet-return memory (completed deliveries, last packet
// outcome, trust posture). Shipped as a staged primitive; the
// consumer wiring story is #1423 (reconcile with the currently-shipped
// `computeOfferedJobs` so the M-LOOP offer list has one authored
// source of truth, then render label + routeRisk on `#job-offer-<id>`
// through the served surface).
//
// Why "staged, not wired yet": `computeOfferedJobs`
// (`packages/aftersign/src/computeOfferedJobs.ts`) already ships as
// the M-LOOP divergence primitive on the served surface — it powers
// `snapshot.story.offeredJobIds`, is played by `aftersign/e2e/
// job-offers-played.spec.ts`, and reads a NARROWER memory bag
// (`trustPosture` / `priorOutcome`) than this module's richer
// (`completedDeliveryIds` / `lastPacketOutcome` / `openedPacketCount`)
// shape. Wiring `selectIoJobOffers` in NOW would produce two parallel
// M-LOOP primitives with drifting vocabularies — the exact failure
// mode #1423 asks us to avoid. That reconciliation is the
// consumer story; this file stays as the target shape the reconciled
// primitive should produce (labels + routeRisk on every offer).
//
// If you're greping "who imports selectIoJobOffers": today only
// `io-job-offers.test.ts` (the run-checks entrypoint). By the time
// #1423 lands, `apps/web/src/aftersign/windowGameSurface.ts` (or the
// reconciled `computeOfferedJobs` return path) will be the shipped
// consumer. If you're touching this file WITHOUT #1423 in scope,
// don't add a second unwired importer — extend #1423 instead.

export type PacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type TrustPosture = "new" | "trusted" | "strained";

export interface IoJobMemoryRecord {
  completedDeliveryIds: readonly string[];
  lastPacketOutcome?: PacketOutcome;
  trustPosture?: TrustPosture;
  openedPacketCount?: number;
}

export interface IoJobOffer {
  id: string;
  label: string;
  routeRisk: "safe" | "risky" | "repair";
  requiresMemory: "first-run" | "sealed-packet" | "opened-packet" | "trusted-return";
}

const FIRST_RUN_JOB: IoJobOffer = {
  id: "blue-seal-stair",
  label: "Carry the blue seal by the lit stair",
  routeRisk: "safe",
  requiresMemory: "first-run",
};

const TRUSTED_RETURN_JOB: IoJobOffer = {
  id: "bell-archive-rainline",
  label: "Take the rainline packet to the Bell Archive",
  routeRisk: "risky",
  requiresMemory: "sealed-packet",
};

const REPAIR_TRUST_JOB: IoJobOffer = {
  id: "orra-wax-apology",
  label: "Bring Saint Orra the wax apology",
  routeRisk: "repair",
  requiresMemory: "opened-packet",
};

const TRUSTED_EXTRA_JOB: IoJobOffer = {
  id: "moth-pier-afterbell",
  label: "Run the afterbell mark to Moth Pier",
  routeRisk: "risky",
  requiresMemory: "trusted-return",
};

export function selectIoJobOffers(memory: IoJobMemoryRecord): IoJobOffer[] {
  const completed = new Set(memory.completedDeliveryIds);

  if (!completed.has("blue-packet")) {
    return [FIRST_RUN_JOB];
  }

  if (memory.lastPacketOutcome === "sealed") {
    const offers = [TRUSTED_RETURN_JOB];
    if (memory.trustPosture === "trusted") {
      offers.push(TRUSTED_EXTRA_JOB);
    }
    return offers;
  }

  if (memory.lastPacketOutcome === "opened") {
    return [REPAIR_TRUST_JOB];
  }

  return [FIRST_RUN_JOB];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkIoJobOffersDivergeByMemory(): void {
  const sealedOffers = selectIoJobOffers({
    completedDeliveryIds: ["blue-packet"],
    lastPacketOutcome: "sealed",
    trustPosture: "trusted",
  });

  const openedOffers = selectIoJobOffers({
    completedDeliveryIds: ["blue-packet"],
    lastPacketOutcome: "opened",
    trustPosture: "strained",
    openedPacketCount: 1,
  });

  const sealedIds = sealedOffers.map((offer) => offer.id).join(",");
  const openedIds = openedOffers.map((offer) => offer.id).join(",");

  assert(sealedIds !== openedIds, "different packet memories must produce different available job actions");
  assert(
    sealedOffers.some((offer) => offer.id === "bell-archive-rainline"),
    "sealed-packet memory must unlock the trusted Bell Archive job",
  );
  assert(
    openedOffers.some((offer) => offer.id === "orra-wax-apology"),
    "opened-packet memory must offer a repair job instead of only changing dialogue",
  );
}

export function checkFirstRunOnlyOffersSafeJob(): void {
  const offers = selectIoJobOffers({ completedDeliveryIds: [] });

  assert(offers.length === 1, "first run should expose one safe job");
  assert(offers[0]?.id === "blue-seal-stair", "first run should start on the blue seal stair job");
  assert(offers[0]?.routeRisk === "safe", "first run job must be safe");
}

export function runIoJobOfferChecks(): void {
  checkFirstRunOnlyOffersSafeJob();
  checkIoJobOffersDivergeByMemory();
}
