export const servedJobOfferByMemory = Object.freeze({
  firstRun: Object.freeze({
    actionId: "take-job-lit-stair",
    label: "Take the lit stair",
    route: "Take the lit stair. Do not stop under the bell rope.",
    risk: "Low risk. Long route. Io can see most of it from the kiosk.",
  }),
  trusted: Object.freeze({
    actionId: "take-job-shuttered-pharmacy",
    label: "Cut behind the pharmacy",
    route: "Cross behind the shuttered pharmacy before the bells count twice.",
    risk: "Short route. Unlit. Better pay because Io trusts your hands.",
  }),
  opened: Object.freeze({
    actionId: "take-job-amber-lamps",
    label: "Stay in the amber lamps",
    route: "Stay in the amber lamps. Let every sign watch the packet.",
    risk: "Low route risk. Low trust. Io keeps the job visible.",
  }),
});

export function servedJobOfferForMemory(memoryState) {
  return servedJobOfferByMemory[memoryState] ?? servedJobOfferByMemory.firstRun;
}
