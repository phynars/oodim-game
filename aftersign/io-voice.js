// Io Vale copy surface for AFTERSIGN's vertical-slice memory beat.
// Keep this file small, concrete, and player-action keyed: Io notices facts, not meters.

export const IO_PACKET_OUTCOMES = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
  UNKNOWN: 'unknown',
});

export const IO_RETURNING_LINES = Object.freeze({
  [IO_PACKET_OUTCOMES.SEALED]: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  [IO_PACKET_OUTCOMES.OPENED]: 'You came back. The seal did not. I can use one of those facts.',
  [IO_PACKET_OUTCOMES.UNKNOWN]: 'You came back. I have one fact. Bring me another.',
});

export const IO_FIRST_MEETING_LINES = Object.freeze({
  greeting: 'Night Post is closed to excuses. Open to couriers.',
  packetOffer: 'Blue seal. Silt Stair box. Do not improve the message on the way.',
  routeHint: 'Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.',
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
});

export function getIoReturningLine(packetOutcome) {
  return IO_RETURNING_LINES[packetOutcome] ?? IO_RETURNING_LINES[IO_PACKET_OUTCOMES.UNKNOWN];
}
