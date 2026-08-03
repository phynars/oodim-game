export const IO_MEMORY_LINE_IDS = Object.freeze({
  RETURNED_SEALED: 'io.returned.sealed',
  RETURNED_OPENED: 'io.returned.opened',
  RETURNED_UNKNOWN: 'io.returned.unknown',
  LISTENED_ROUTE: 'io.route.listened',
  SKIPPED_ROUTE: 'io.route.skipped',
});

const IO_MEMORY_LINES = Object.freeze({
  [IO_MEMORY_LINE_IDS.RETURNED_SEALED]: {
    id: IO_MEMORY_LINE_IDS.RETURNED_SEALED,
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    references: Object.freeze(['returned_after_delivery', 'packet_delivered_sealed']),
  },
  [IO_MEMORY_LINE_IDS.RETURNED_OPENED]: {
    id: IO_MEMORY_LINE_IDS.RETURNED_OPENED,
    text: 'You came back. The seal did not. I can use one of those facts.',
    references: Object.freeze(['returned_after_delivery', 'packet_opened']),
  },
  [IO_MEMORY_LINE_IDS.RETURNED_UNKNOWN]: {
    id: IO_MEMORY_LINE_IDS.RETURNED_UNKNOWN,
    text: 'You came back. I have no clean mark for what happened to the seal. That is also a mark.',
    references: Object.freeze(['returned_after_delivery', 'packet_outcome_unknown']),
  },
  [IO_MEMORY_LINE_IDS.LISTENED_ROUTE]: {
    id: IO_MEMORY_LINE_IDS.LISTENED_ROUTE,
    text: 'You listened before you ran. Rare habit. Keep it.',
    references: Object.freeze(['listened_to_route']),
  },
  [IO_MEMORY_LINE_IDS.SKIPPED_ROUTE]: {
    id: IO_MEMORY_LINE_IDS.SKIPPED_ROUTE,
    text: 'You found the box anyway. Next time, let me finish saving your life.',
    references: Object.freeze(['skipped_route_instructions']),
  },
});

export function getIoMemoryLine(memory = {}) {
  if (memory?.packetOutcome === 'sealed') {
    return IO_MEMORY_LINES[IO_MEMORY_LINE_IDS.RETURNED_SEALED];
  }

  if (memory?.packetOutcome === 'opened') {
    return IO_MEMORY_LINES[IO_MEMORY_LINE_IDS.RETURNED_OPENED];
  }

  return IO_MEMORY_LINES[IO_MEMORY_LINE_IDS.RETURNED_UNKNOWN];
}

export function getIoRouteLine(memory = {}) {
  if (memory?.heardRoute === false) {
    return IO_MEMORY_LINES[IO_MEMORY_LINE_IDS.SKIPPED_ROUTE];
  }

  return IO_MEMORY_LINES[IO_MEMORY_LINE_IDS.LISTENED_ROUTE];
}

export function listIoMemoryLines() {
  return Object.values(IO_MEMORY_LINES);
}
