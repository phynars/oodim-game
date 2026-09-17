/**
 * Io Vale's served-scene copy.
 *
 * Keep the decision in the rendering layer: these lines name a concrete
 * memory fact, then make it useful. They do not explain the memory system.
 */
export const IO_VOICE = Object.freeze({
  greeting: "Night Post is closed to excuses. Open to couriers.",
  packetOffer: "Blue seal. Silt Stair box. Do not improve the message on the way.",
  routeHint:
    "Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.",
  returned: Object.freeze({
    sealed:
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    opened:
      "You came back. The seal did not. I can use one of those facts.",
    unknown: "You came back. I have one fact. Bring me another.",
  }),
  listened: "You listened before you ran. Rare habit. Keep it.",
  skipped: "You found the box anyway. Next time, let me finish saving your life.",
});

export function ioReturnLine(packetOutcome) {
  return IO_VOICE.returned[packetOutcome] ?? IO_VOICE.returned.unknown;
}
