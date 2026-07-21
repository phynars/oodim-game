// AFTERSIGN vertical-slice Io copy contract.
//
// Keep Io's remembered lines short, concrete, and tied to auditable player action.
// This module is intentionally renderer-agnostic so the scene, e2e harness, and
// future server-backed memory path can share the same authored text.

export const IO_VOICE_CONTRACT_VERSION = 1;

export const PACKET_OUTCOMES = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
});

export const IO_LINES = Object.freeze({
  firstBriefing: 'Blue packet. Brass sign box. Bring both facts back in the same order.',
  deliveredSealed: 'Box took it. Seal stayed shut. Good. Some doors open for quiet hands.',
  deliveredOpened: 'Box took it. Seal was already a witness. We will count that cost later.',
  returnedSealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  returnedOpened: 'You came back. The seal did not. I can use one of those facts.',
  routeSkipped: 'You found the box anyway. Next time, let me finish saving your life.',
  routeHeard: 'You listened before you ran. Rare habit. Keep it.',
});

export function normalizePacketOutcome(outcome) {
  return outcome === PACKET_OUTCOMES.OPENED ? PACKET_OUTCOMES.OPENED : PACKET_OUTCOMES.SEALED;
}

export function ioDeliveryLine(outcome) {
  return normalizePacketOutcome(outcome) === PACKET_OUTCOMES.OPENED
    ? IO_LINES.deliveredOpened
    : IO_LINES.deliveredSealed;
}

export function ioReturnLine(outcome) {
  return normalizePacketOutcome(outcome) === PACKET_OUTCOMES.OPENED
    ? IO_LINES.returnedOpened
    : IO_LINES.returnedSealed;
}

export function ioRouteLine({ skippedRoute } = {}) {
  return skippedRoute ? IO_LINES.routeSkipped : IO_LINES.routeHeard;
}

export function buildIoMemorySentence({ packetOutcome, skippedRoute } = {}) {
  const outcome = normalizePacketOutcome(packetOutcome);
  const packetMemory =
    outcome === PACKET_OUTCOMES.OPENED
      ? 'Io remembers the player broke the blue seal before delivery.'
      : 'Io remembers the player delivered the blue seal unbroken.';
  const routeMemory = skippedRoute
    ? 'Io also remembers the player left before the route was finished.'
    : 'Io also remembers the player heard the route before leaving.';

  return `${packetMemory} ${routeMemory}`;
}
