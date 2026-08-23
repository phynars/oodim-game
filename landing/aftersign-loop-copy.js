export const aftersignLoopCopy = Object.freeze({
  firstRun: Object.freeze({
    ioOffer: "One safe job. One blue seal. Bring both back intact.",
    safeJobLabel: "Take the lantern stair",
    safeJobHint: "Long way. Lit all the way down.",
    routeRiskPrompt: "The bell starts before you reach the turn.",
    riskAvoidLabel: "Wait under the lantern",
    riskAvoidReply: "Good. Vey forgives slow couriers more often than dead ones.",
    riskTakeLabel: "Cross during the bell",
    riskTakeReply: "Fast. Loud. The stair will remember your shoes.",
    returnLine: "You made one run. Now the city has an opinion."
  }),
  trustedRun: Object.freeze({
    ioOffer: "You kept the seal once. I can risk giving you a stranger door.",
    safeJobLabel: "Carry the pharmacy receipt",
    safeJobHint: "Saint Orra pays in names, not coin.",
    routeRiskPrompt: "The dark cut is open. It was not, before.",
    riskAvoidLabel: "Stay with the lamps",
    riskAvoidReply: "Careful again. That becomes a pattern.",
    riskTakeLabel: "Use the dark cut",
    riskTakeReply: "There. Now you owe the dark a clean exit.",
    returnLine: "Trust changed the work. Do not confuse that with mercy."
  }),
  distrustedRun: Object.freeze({
    ioOffer: "The seal opened. So the work narrows.",
    safeJobLabel: "Return the torn receipt",
    safeJobHint: "No shortcuts for hands I have to watch.",
    routeRiskPrompt: "The bell hears torn paper before footsteps.",
    riskAvoidLabel: "Keep the receipt hidden",
    riskAvoidReply: "You can hide paper. Not a habit.",
    riskTakeLabel: "Show the receipt at the stair",
    riskTakeReply: "Bold is not the same as repaired.",
    returnLine: "You came back. That keeps you employed. Barely."
  })
});

export function getAftersignLoopCopy(memory) {
  if (memory?.packetOutcome === "delivered_sealed") {
    return aftersignLoopCopy.trustedRun;
  }

  if (memory?.packetOutcome === "opened") {
    return aftersignLoopCopy.distrustedRun;
  }

  return aftersignLoopCopy.firstRun;
}
