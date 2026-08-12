const IO_RETURN_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  unknown: 'You came back. I have one fact. Bring me another.',
});

const IO_SLICE_LINES = Object.freeze({
  greeting: 'Night Post is closed to excuses. Open to couriers.',
  packetOffer: 'Blue seal. Silt Stair box. Do not improve the message on the way.',
  routeHint: 'Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.',
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
});

export function getIoReturnLine(packetOutcome) {
  if (packetOutcome === 'sealed') {
    return IO_RETURN_LINES.sealed;
  }

  if (packetOutcome === 'opened') {
    return IO_RETURN_LINES.opened;
  }

  return IO_RETURN_LINES.unknown;
}

export function getIoSliceLine(lineId) {
  return IO_SLICE_LINES[lineId] ?? '';
}

export const ioVoice = Object.freeze({
  ...IO_SLICE_LINES,
  returnLines: IO_RETURN_LINES,
});
