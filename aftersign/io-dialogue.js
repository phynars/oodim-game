export const IO_PACKET_MEMORY_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  listened: 'You listened before you ran. Rare habit. Keep it.',
  unknown: 'You came back. Good. I can work with a second fact.'
});

export function getIoPacketMemoryLine(memory = {}) {
  if (memory.packetOutcome === 'delivered_sealed' || memory.packetOutcome === 'sealed') {
    return IO_PACKET_MEMORY_LINES.sealed;
  }

  if (memory.packetOutcome === 'opened') {
    return IO_PACKET_MEMORY_LINES.opened;
  }

  if (memory.routeInstruction === 'skipped') {
    return IO_PACKET_MEMORY_LINES.skippedRoute;
  }

  if (memory.routeInstruction === 'listened') {
    return IO_PACKET_MEMORY_LINES.listened;
  }

  return IO_PACKET_MEMORY_LINES.unknown;
}

export function buildIoReturnBeat(memory = {}) {
  return {
    speaker: 'Io',
    text: getIoPacketMemoryLine(memory),
    memoryKey: memory.packetOutcome || memory.routeInstruction || 'unknown',
    effect: 'recognition'
  };
}
