/**
 * Io Vale's compact, consequence-forward voice surface.
 * Kept separate so the served scene can select copy from a concrete run fact.
 */
const RETURN_LINES = Object.freeze({
  sealed: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
  unknown: "You came back. I have one fact. Bring me another.",
});

const JOB_LINES = Object.freeze({
  safe: "Dry boards. A small packet. Bring both back in the same condition.",
  trusted: "The stair is lit tonight. That is not the same as safe. Take the archive pouch.",
  opened: "You know what a broken seal costs. Carry the bell packet anyway.",
});

export function chooseIoReturnLine(packetOutcome) {
  return RETURN_LINES[packetOutcome] ?? RETURN_LINES.unknown;
}

export function chooseIoJobLine(jobKind) {
  return JOB_LINES[jobKind] ?? JOB_LINES.safe;
}

export const ioVoice = Object.freeze({
  greeting: "Night Post is closed to excuses. Open to couriers.",
  packetOffer: "Blue seal. Silt Stair box. Do not improve the message on the way.",
  routeHint: "Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.",
  listened: "You listened before you ran. Rare habit. Keep it.",
  skipped: "You found the box anyway. Next time, let me finish saving your life.",
});
