// Memory-branched job-offer copy for Io's next-job handoff.
//
// This module is the frozen home of the strings a scene renderer
// paints when Io hands the player the red tag. Kept as .js so the
// copy stays legible to non-TS reviewers; the TS companion .d.ts
// beside this file declares the shape.
//
// CONTRACT (do not remove without landing every consumer in the same
// PR — the aftersign vitest blocking lane guards this): the exported
// table has three branches keyed `firstRun` / `trusted` / `opened`,
// each carrying the fields the shipped surface projects onto
// `story.nextJob.offer.copy`:
//
//   id, tappableActionId, title, actionLabel, summary, ioLine,
//   riskPrompt, safeRouteLabel, riskyRouteLabel, route, risk
//
// Consumers on record: `aftersignJobOfferCopy.consumer.test.ts`,
// `aftersignJobTakeFeel.consumer.test.ts`,
// `twoRoundOfferTapDivergence.consumer.test.ts`,
// `harness/bootWindowGame.ts`.

const FIRST_RUN = Object.freeze({
  id: "aftersign.jobOffer.firstRun",
  tappableActionId: "take-job-blue-seal-safe",
  title: "One safe job. One blue seal.",
  actionLabel: "Take the blue-seal job",
  summary: "Io gives you the watched route: short walk, sealed packet, no witnesses needed.",
  ioLine: "Bring it back the way I gave it to you. Closed seal, open account.",
  riskPrompt: "Low risk. Long light. The kiosk keeps eyes on you most of the way.",
  safeRouteLabel: "Lit stair — under Io's window",
  riskyRouteLabel: "Cut past the bell rope",
  route: "Take the lit stair. Do not stop under the bell rope.",
  risk: "Low risk. Long light. Io can see most of it from the kiosk.",
});

const TRUSTED = Object.freeze({
  id: "aftersign.jobOffer.trusted",
  tappableActionId: "take-job-orra-name-risk",
  title: "Orra's name. A stranger door.",
  actionLabel: "Take Orra's-name job",
  summary: "You kept the seal once. Io widens the work: darker route, cleaner pay.",
  ioLine: "You kept the seal once. I can risk your hands on a door that lies.",
  riskPrompt: "Short route, unlit. Better pay because Io has one good fact about you.",
  safeRouteLabel: "Long way — past the kiosk",
  riskyRouteLabel: "Behind the shuttered pharmacy",
  route: "Cross behind the shuttered pharmacy before the bells count twice.",
  risk: "Short route. Unlit. Better pay because Io has one good fact about you.",
});

const OPENED = Object.freeze({
  id: "aftersign.jobOffer.opened",
  tappableActionId: "take-job-wax-debt-repair",
  title: "Wax debt. Narrow work.",
  actionLabel: "Take the wax-debt job",
  summary: "The seal opened. Io narrows the work: torn receipt, watched return.",
  ioLine: "The seal opened. I can still use you. Not wide work.",
  riskPrompt: "Narrow work. Debt carried. Io keeps the receipt until the wax is paid.",
  safeRouteLabel: "Dark cut — quickest, watched only at the end",
  riskyRouteLabel: "Long way — across the lit square",
  route: "Take the dark cut. Do not run under the bell rope this time.",
  risk: "Narrow work. Debt carried. The receipt stays torn until Io re-seals it.",
});

/**
 * The frozen memory-branch table. Consumers read
 * `AFTERSIGN_JOB_OFFER_COPY.firstRun / .trusted / .opened` directly
 * for ground-truth assertions; the harness reads it via
 * `chooseAftersignJobOfferCopy(memory)`.
 */
export const AFTERSIGN_JOB_OFFER_COPY = Object.freeze({
  firstRun: FIRST_RUN,
  trusted: TRUSTED,
  opened: OPENED,
});

function normalizeOutcome(memory) {
  if (!memory || typeof memory !== "object") return "pending";

  // Explicit boolean shortcuts win — the harness sets these based on
  // the durable-save state.
  if (memory.packetOpened === true) return "opened";
  if (memory.deliveredSealed === true) return "sealed";

  const raw =
    memory.firstPacketOutcome ??
    memory.packetOutcome ??
    memory.packet_outcome ??
    memory.lastPacketOutcome;

  if (raw === "sealed" || raw === "delivered_sealed" || raw === "packet-sealed") {
    return "sealed";
  }
  if (raw === "opened" || raw === "opened_packet" || raw === "packet-opened") {
    return "opened";
  }
  return "pending";
}

/**
 * Return the frozen row Io hands the player on the CURRENT memory
 * branch. Fresh boot (no packet outcome recorded) → firstRun.
 * Sealed delivery → trusted. Opened packet → opened.
 *
 * @param {object} [memory]
 * @returns {typeof FIRST_RUN | typeof TRUSTED | typeof OPENED}
 */
export function chooseAftersignJobOfferCopy(memory = {}) {
  const outcome = normalizeOutcome(memory);
  if (outcome === "sealed") return TRUSTED;
  if (outcome === "opened") return OPENED;
  return FIRST_RUN;
}
