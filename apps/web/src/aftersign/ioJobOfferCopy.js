/**
 * Io's job board voice. A memory fact must alter the work offered, not only
 * the greeting that frames it.
 */
export const IO_JOB_OFFERS = Object.freeze({
  firstRun: Object.freeze({
    id: 'lamp-oil',
    label: 'Carry lamp oil to Moth Pier',
    detail: 'Lit stair. No shortcuts.',
    ioLine: 'Start with oil. If it spills, someone walks home blind.',
  }),
  sealedReturn: Object.freeze({
    id: 'archive-receipt',
    label: 'Take the archive receipt through the dark cut',
    detail: 'Short route. The bell is already listening.',
    ioLine: 'You kept one seal. I can risk you with a receipt.',
  }),
  openedReturn: Object.freeze({
    id: 'witness-copy',
    label: 'Bring a witness copy to the lit stair',
    detail: 'Long route. Keep it where people can see it.',
    ioLine: 'You opened the last thing. Carry this where the city can watch.',
  }),
});

export function getIoJobOffer(packetOutcome) {
  if (packetOutcome === 'sealed') return IO_JOB_OFFERS.sealedReturn;
  if (packetOutcome === 'opened') return IO_JOB_OFFERS.openedReturn;
  return IO_JOB_OFFERS.firstRun;
}
