/**
 * Player-facing Io copy for AFTERSIGN job offers.
 *
 * Keep this module small and boring: it is a bridge between memory-shaped
 * state and tappable, player-visible words on the served page.
 */

export const IO_JOB_COPY = Object.freeze({
  firstRun: {
    greeting: 'You made it before the bells changed their mind.',
    prompt: 'One safe job. Blue seal. Short stair. Bring it back with its mouth shut.',
    offers: [
      {
        id: 'blue-seal-safe',
        label: 'Take the blue-seal job',
        description: 'A dry packet. A lit stair. Io watching the ledger more than your face.',
      },
    ],
  },
  trusted: {
    greeting: 'You brought one seal home clean. That buys you a worse kind of trust.',
    prompt: 'Two jobs tonight. Pick the one you can stand being remembered for.',
    offers: [
      {
        id: 'blue-seal-safe',
        label: 'Run the lit stair',
        description: 'Long way up. Lanterns still burning. Fewer reasons to lie afterward.',
      },
      {
        id: 'orra-name-risk',
        label: 'Carry Orra’s name',
        description: 'Short dark cut. A living sign. A name somebody paid to lose.',
      },
    ],
  },
  compromised: {
    greeting: 'You came back. The seal did not. I can still use a courier with hands like that.',
    prompt: 'One job. No sealed paper until you earn paper again.',
    offers: [
      {
        id: 'lamp-check-compromised',
        label: 'Check the lower lamp',
        description: 'No packet. No promise. Just a light that goes out when the wrong person remembers it.',
      },
    ],
  },
});

export function getIoJobCopy(memory = {}) {
  if (memory.firstPacketOutcome === 'delivered-sealed') {
    return IO_JOB_COPY.trusted;
  }

  if (memory.firstPacketOutcome === 'opened') {
    return IO_JOB_COPY.compromised;
  }

  return IO_JOB_COPY.firstRun;
}
