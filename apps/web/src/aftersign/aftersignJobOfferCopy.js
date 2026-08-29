export const AFTERSIGN_JOB_OFFER_COPY = Object.freeze({
  firstRun: Object.freeze({
    id: "blue-seal-safe",
    tappableActionId: "take-job-blue-seal-safe",
    title: "Blue seal, short stairs",
    actionLabel: "Take the blue seal job",
    summary: "Carry Io's sealed packet to the stair box. Keep it shut. Come back breathing.",
    ioLine: "One safe job. Blue seal, stair box, no heroics. Bring me back a fact I can use.",
    riskPrompt: "The lit stair is longer. The dark cut is faster. Vey charges for fast.",
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
    summary: "Carry a folded name from Saint Orra. Ask who it hurts before you promise.",
    ioLine: "You kept one seal honest. That buys you Orra's kind of trouble. Ask twice before carrying a name.",
    riskPrompt: "Orra's lantern knows old names. The short way passes under it. The long way avoids the saint.",
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
    summary: "Repair what opening the packet cost. Every hand on the route will be watching yours.",
    ioLine: "You opened what was not yours. Useful skill, expensive habit. Tonight you pay it down.",
    riskPrompt: "The public stair keeps you honest. The service cut keeps you unseen.",
    safeRouteLabel: "Use the public stair",
    riskyRouteLabel: "Use the service cut",
    route: "Stay in the amber lamps. Let every sign watch the packet.",
    risk: "Low route risk. Low trust. Io keeps the job visible.",
  }),
});

export function chooseAftersignJobOfferCopy(memory = {}) {
  if (memory.packetOpened === true || memory.firstPacketOutcome === "opened") {
    return AFTERSIGN_JOB_OFFER_COPY.opened;
  }

  if (
    memory.trustPosture === "trusted" ||
    memory.ioTrustPosture === "trusted" ||
    memory.firstPacketOutcome === "sealed" ||
    memory.deliveredSealed === true
  ) {
    return AFTERSIGN_JOB_OFFER_COPY.trusted;
  }

  return AFTERSIGN_JOB_OFFER_COPY.firstRun;
}
