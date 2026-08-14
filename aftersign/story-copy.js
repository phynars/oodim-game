/**
 * Player-visible story copy for AFTERSIGN's vertical slice.
 *
 * Keep these lines short and concrete: Io should sound like a dispatcher
 * weighing evidence, not a tutorial explaining the memory system.
 */

export const PACKET_OUTCOMES = Object.freeze({
  sealed: 'sealed',
  opened: 'opened',
  withheld: 'withheld',
  unknown: 'unknown',
});

export const IO_RETURNING_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  withheld: 'You came back. The packet did not. I can still count to one.',
  unknown: 'You came back. We will start with that.',
});

export const IO_ROUTE_LINES = Object.freeze({
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
});

export const IO_PACKET_CHOICE_COPY = Object.freeze({
  prompt: 'The blue seal is warm under your thumb.',
  keepSealed: 'Keep it sealed',
  openPacket: 'Break the seal',
  keptResult: 'The wax holds. Somewhere above the rain, a bell answers once.',
  openedResult: 'The wax gives. The packet remembers your hands.',
});

export function normalizePacketOutcome(outcome) {
  if (outcome === PACKET_OUTCOMES.sealed) return PACKET_OUTCOMES.sealed;
  if (outcome === PACKET_OUTCOMES.opened) return PACKET_OUTCOMES.opened;
  if (outcome === PACKET_OUTCOMES.withheld) return PACKET_OUTCOMES.withheld;
  return PACKET_OUTCOMES.unknown;
}

export function getIoReturningLine(memory = {}) {
  return IO_RETURNING_LINES[normalizePacketOutcome(memory.packetOutcome)];
}

export function getIoRouteLine(memory = {}) {
  return memory.listenedToRoute ? IO_ROUTE_LINES.listened : IO_ROUTE_LINES.skipped;
}
