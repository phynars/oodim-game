// AFTERSIGN — Io Vale authored voice surface.
// Keep these lines short, concrete, and tied to auditable player actions.

export const IO_PACKET_OUTCOMES = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
  WITHHELD: 'withheld',
  RETURNED: 'returned',
});

export const IO_ROUTE_BEHAVIORS = Object.freeze({
  LISTENED: 'listened',
  SKIPPED: 'skipped',
});

export const IO_RETURN_POSTURES = Object.freeze({
  KIND: 'kind',
  EVASIVE: 'evasive',
  BLUNT: 'blunt',
});

export const IO_FIRST_MEETING_LINES = Object.freeze({
  arrival: 'Night Post is closed to tourists. Lucky you look lost, not curious.',
  offerPacket: 'Blue seal. Dry hands. Do not make me regret either one.',
  routePrompt: 'Three lanterns down. Brass box under the saint sign. Read the marks before the stairs read you.',
  inspectKettle: 'No tea. Kettle stays on. Some lies help morale.',
  inspectLedger: 'Names go in ink. Debts go in pencil. I am optimistic by profession.',
  inspectPacketSealed: 'Wax is intact. It has one job. So do you.',
  inspectPacketOpened: 'Broken wax tells the truth faster than people do.',
  deliverSealed: 'Good. The box took it whole.',
  deliverOpened: 'The box took it. The seal did not arrive with it.',
  returnSealed: 'You carried a thing that was not yours and left it that way. That is rarer than courage.',
  returnOpened: 'Curiosity is not a crime. It is a cost. You just put it on my ledger.',
});

export const IO_RETURNING_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  withheld: 'You came back. The packet did not. I am listening for the part where that improves.',
  returned: 'You came back with the job unfinished. Honest failure is still honest. Once.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  listenedRoute: 'You listened before you ran. Rare habit. Keep it.',
  kindReturn: 'Kind answer. Dangerous habit. Useful one.',
  evasiveReturn: 'That was not an answer. I will file it under weather.',
  bluntReturn: 'Plain truth, then. Easier to carry than a pretty one.',
  unknown: 'You came back. I do not have the rest yet. Stand where the light can count you.',
});

export function getIoPacketOutcomeLine(packetOutcome) {
  switch (packetOutcome) {
    case IO_PACKET_OUTCOMES.SEALED:
      return IO_RETURNING_LINES.sealed;
    case IO_PACKET_OUTCOMES.OPENED:
      return IO_RETURNING_LINES.opened;
    case IO_PACKET_OUTCOMES.WITHHELD:
      return IO_RETURNING_LINES.withheld;
    case IO_PACKET_OUTCOMES.RETURNED:
      return IO_RETURNING_LINES.returned;
    default:
      return IO_RETURNING_LINES.unknown;
  }
}

export function getIoRouteBehaviorLine(routeBehavior) {
  switch (routeBehavior) {
    case IO_ROUTE_BEHAVIORS.LISTENED:
      return IO_RETURNING_LINES.listenedRoute;
    case IO_ROUTE_BEHAVIORS.SKIPPED:
      return IO_RETURNING_LINES.skippedRoute;
    default:
      return null;
  }
}

export function getIoReturnPostureLine(returnPosture) {
  switch (returnPosture) {
    case IO_RETURN_POSTURES.KIND:
      return IO_RETURNING_LINES.kindReturn;
    case IO_RETURN_POSTURES.EVASIVE:
      return IO_RETURNING_LINES.evasiveReturn;
    case IO_RETURN_POSTURES.BLUNT:
      return IO_RETURNING_LINES.bluntReturn;
    default:
      return null;
  }
}

export function buildIoReturningBeat(memory = {}) {
  const lines = [getIoPacketOutcomeLine(memory.packetOutcome)];
  const routeLine = getIoRouteBehaviorLine(memory.routeBehavior);
  const postureLine = getIoReturnPostureLine(memory.returnPosture);

  if (routeLine) lines.push(routeLine);
  if (postureLine) lines.push(postureLine);

  return lines;
}
