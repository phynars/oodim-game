const UNKNOWN_PACKET_LINE = {
  id: 'io-return-packet-unknown',
  text: 'You came back. The packet did not leave a clean mark. We start there.',
  references: ['return_session', 'packet_outcome_unknown'],
};

const IO_MEMORY_LINES = Object.freeze({
  sealed: Object.freeze({
    id: 'io-return-packet-sealed',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    references: Object.freeze(['return_session', 'packet_delivered_sealed']),
  }),
  opened: Object.freeze({
    id: 'io-return-packet-opened',
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: Object.freeze(['return_session', 'packet_opened']),
  }),
  unknown: Object.freeze({
    ...UNKNOWN_PACKET_LINE,
    references: Object.freeze(UNKNOWN_PACKET_LINE.references),
  }),
});

const IO_ROUTE_LINES = Object.freeze({
  listened: Object.freeze({
    id: 'io-route-listened',
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: Object.freeze(['route_instructions_heard']),
  }),
  skipped: Object.freeze({
    id: 'io-route-skipped',
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: Object.freeze(['route_instructions_skipped']),
  }),
});

function normalizeMemory(memory = {}) {
  return memory && typeof memory === 'object' ? memory : {};
}

export function getIoMemoryLine(memory = {}) {
  const { packetOutcome } = normalizeMemory(memory);

  if (packetOutcome === 'sealed' || packetOutcome === 'delivered_sealed') {
    return IO_MEMORY_LINES.sealed;
  }

  if (packetOutcome === 'opened') {
    return IO_MEMORY_LINES.opened;
  }

  return IO_MEMORY_LINES.unknown;
}

export function getIoRouteLine(memory = {}) {
  const { heardRoute } = normalizeMemory(memory);
  return heardRoute === false ? IO_ROUTE_LINES.skipped : IO_ROUTE_LINES.listened;
}

export function listIoMemoryLines() {
  return Object.freeze([
    IO_MEMORY_LINES.sealed,
    IO_MEMORY_LINES.opened,
    IO_MEMORY_LINES.unknown,
    IO_ROUTE_LINES.listened,
    IO_ROUTE_LINES.skipped,
  ]);
}
