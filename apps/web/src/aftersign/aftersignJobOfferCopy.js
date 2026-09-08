// AFTERSIGN — served job-offer copy.
// Consumed by aftersign/main.js when the packet-offered beat renders
// the live #offeredJobs surface, and by
// `harness/bootWindowGame.ts` when the served-page snapshot at
// `story.nextJob.offer.copy` needs the strings a scene renderer will
// paint (title / ioLine / actionLabel / summary / riskPrompt /
// safeRouteLabel / riskyRouteLabel / route / risk).
//
// Contract mirrored in `aftersignJobOfferCopy.d.ts` — if you add or
// remove a field here, mirror the shape there (and update the two
// consumer specs + the take-feel harness that read the fields).

const JOB_OFFER_COPY = Object.freeze({
  firstRun: Object.freeze({
    id: "blue-seal-safe",
    tappableActionId: "take-job-blue-seal-safe",
    title: "Blue seal, short stairs",
    actionLabel: "Take the blue seal job",
    summary:
      "Carry Io's sealed packet to the stair box. Keep it shut. Come back breathing.",
    ioLine:
      "One safe job. Blue seal, stair box, no heroics. Bring me back a fact I can use.",
    riskPrompt:
      "The lit stair is longer. The dark cut is faster. Vey charges for fast.",
    safeRouteLabel: "Take the lit stair",
    riskyRouteLabel: "Take the dark cut",
    route: "Take the lit stair. Do not stop under the bell rope.",
    risk: "Low risk. Long route. Io can see most of it from the kiosk.",
  }),
  trusted: Object.freeze({
    id: "orra-name-risk",
    tappableActionId: "take-job-orra-name-risk",
    title: "Orra's folded name",
    actionLabel: "Take Orra's name job",
    summary:
      "Carry a folded name from Saint Orra. Ask who it hurts before you promise.",
    ioLine:
      "You kept one seal honest. That buys you Orra's kind of trouble. Ask twice before carrying a name.",
    riskPrompt:
      "Orra's lantern knows old names. The short way passes under it. The long way avoids the saint.",
    safeRouteLabel: "Avoid Orra's lantern",
    riskyRouteLabel: "Pass under Orra's lantern",
    route: "Cross behind the shuttered pharmacy before the bells count twice.",
    risk: "Short route. Unlit. Better pay because Io trusts your hands.",
  }),
  opened: Object.freeze({
    id: "wax-debt-repair",
    tappableActionId: "take-job-wax-debt-repair",
    title: "Wax debt, watched hands",
    actionLabel: "Take the wax debt job",
    summary:
      "Repair what opening the packet cost. Every hand on the route will be watching yours.",
    ioLine:
      "You opened what was not yours. Useful skill, expensive habit. Tonight you pay it down.",
    riskPrompt:
      "The public stair keeps you honest. The service cut keeps you unseen.",
    safeRouteLabel: "Use the public stair",
    riskyRouteLabel: "Use the service cut",
    route: "Stay in the amber lamps. Let every sign watch the packet.",
    risk: "Low route risk. Low trust. Io keeps the job visible.",
  }),
});

const normalizePacketOutcome = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : null;

export function chooseAftersignJobOfferCopy({
  firstPacketOutcome = null,
  packetOpened = false,
  deliveredSealed = false,
  trustPosture = null,
  ioTrustPosture = null,
} = {}) {
  const outcome = normalizePacketOutcome(firstPacketOutcome);
  if (packetOpened || outcome === "opened") {
    return JOB_OFFER_COPY.opened;
  }
  if (
    deliveredSealed ||
    outcome === "sealed" ||
    outcome === "delivered_sealed" ||
    trustPosture === "trusted" ||
    ioTrustPosture === "trusted"
  ) {
    return JOB_OFFER_COPY.trusted;
  }
  return JOB_OFFER_COPY.firstRun;
}

export { JOB_OFFER_COPY as AFTERSIGN_JOB_OFFER_COPY };
