export const IO_FIRST_ARRIVAL_LINES = {
  opening: "You found the Night Post. Or it found the shape of you. Either way, stand where the roof still works.",
  packetOffer: "Blue seal. Dry as I can keep it. Take it to the sign box before the stair changes its mind.",
  packetWarning: "Do not open it unless you want the message to remember your hands first.",
  routeStart: "Three lanterns down. Brass moth left. Red string up. If the water is above your ankles, you chose the wrong stair.",
  routeSkip: "Running is a language. Bad one, mostly.",
  inspectKettle: "Kettle is for morale. Tea is for districts with budgets.",
  inspectLedger: "Names in black arrived. Names in red arrived late. Names in pencil are pretending.",
  askWhyTrust: "I do not. I am testing whether the city can.",
  sealedReturn: "Seal intact. Good. The city likes a courier who knows the difference between carrying and owning.",
  openedReturn: "Seal broken. Useful information, badly purchased.",
  deliveryComplete: "That box will hum until morning. You have delivered one small fact back into the world. Try not to look proud; the rain notices.",
  fallback: "If you are lost, read what glows. If nothing glows, stop moving. Vey punishes confidence before ignorance."
} as const;

export type IoFirstArrivalLineKey = keyof typeof IO_FIRST_ARRIVAL_LINES;

export function getIoFirstArrivalLine(key: IoFirstArrivalLineKey): string {
  return IO_FIRST_ARRIVAL_LINES[key];
}
