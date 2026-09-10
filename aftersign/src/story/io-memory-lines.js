export const IO_RETURNING_MEMORY_LINES = Object.freeze({
  sealed: 'You came back. Blue seal intact. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  heardRoute: 'You listened before you ran. Rare habit. Keep it.',
});

export function getIoReturningMemoryLine(memory) {
  if (memory?.packetOutcome === 'opened') return IO_RETURNING_MEMORY_LINES.opened;
  if (memory?.packetOutcome === 'sealed') return IO_RETURNING_MEMORY_LINES.sealed;
  if (memory?.heardRoute === false) return IO_RETURNING_MEMORY_LINES.skippedRoute;
  if (memory?.heardRoute === true) return IO_RETURNING_MEMORY_LINES.heardRoute;
  return 'You came back. Good. Vey keeps a ledger for that.';
}
