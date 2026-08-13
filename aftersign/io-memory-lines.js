export const IO_PACKET_OUTCOMES = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
  UNKNOWN: 'unknown',
});

export const IO_ROUTE_ATTENTION = Object.freeze({
  LISTENED: 'listened',
  SKIPPED: 'skipped',
  UNKNOWN: 'unknown',
});

const RETURN_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
  listened: 'You listened before you ran. Rare habit. Keep it.',
  unknown: 'Back already. Good. The stairs kept your shape.',
});

export function getIoReturnLine(memory = {}) {
  const packetOutcome = memory.packetOutcome || IO_PACKET_OUTCOMES.UNKNOWN;
  const routeAttention = memory.routeAttention || IO_ROUTE_ATTENTION.UNKNOWN;

  if (packetOutcome === IO_PACKET_OUTCOMES.SEALED) return RETURN_LINES.sealed;
  if (packetOutcome === IO_PACKET_OUTCOMES.OPENED) return RETURN_LINES.opened;
  if (routeAttention === IO_ROUTE_ATTENTION.SKIPPED) return RETURN_LINES.skipped;
  if (routeAttention === IO_ROUTE_ATTENTION.LISTENED) return RETURN_LINES.listened;

  return RETURN_LINES.unknown;
}

export function getIoPacketOfferLine() {
  return 'Blue packet. Brass box by the stairwell. Keep the seal honest, and I may do the same for you.';
}

export function getIoPacketChoiceLines() {
  return Object.freeze({
    keepSealed: 'Leave the seal intact.',
    openPacket: 'Break the wax and read what was trusted to you.',
  });
}

export function registerIoDialogue(target = globalThis) {
  const api = Object.freeze({
    packetOutcomes: IO_PACKET_OUTCOMES,
    routeAttention: IO_ROUTE_ATTENTION,
    getReturnLine: getIoReturnLine,
    getPacketOfferLine: getIoPacketOfferLine,
    getPacketChoiceLines: getIoPacketChoiceLines,
  });

  target.__aftersignIoDialogue = api;
  return api;
}

registerIoDialogue();
