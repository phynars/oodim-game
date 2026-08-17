/**
 * Io Vale dialogue for AFTERSIGN's first persistent-memory slice.
 *
 * This module is intentionally data-first: the harness can assert that each
 * returning-session line references the exact saved packet outcome instead of
 * a loose affinity score.
 */

export const IO_PACKET_OUTCOME = Object.freeze({
  sealed: 'sealed',
  opened: 'opened',
  unknown: 'unknown',
});

export const IO_RETURN_TONE = Object.freeze({
  kind: 'kind',
  evasive: 'evasive',
  blunt: 'blunt',
  silent: 'silent',
});

export const ioMemoryDialogue = Object.freeze({
  firstArrival: Object.freeze([
    {
      id: 'io.firstArrival.open',
      speaker: 'io',
      text: 'Night Post is closed to strangers. Luckily, you look more lost than strange.',
    },
    {
      id: 'io.firstArrival.packet',
      speaker: 'io',
      text: 'Blue packet. Red wax. Take it to the sign box under the moth lamps. Bring back what is left of your honesty.',
    },
    {
      id: 'io.firstArrival.route',
      speaker: 'io',
      text: 'Follow the wet brass arrows. If a lantern blinks twice, do not step where it points.',
    },
  ]),

  packetChoice: Object.freeze({
    [IO_PACKET_OUTCOME.sealed]: Object.freeze({
      id: 'io.packetChoice.sealed',
      speaker: 'io',
      text: 'Seal held. Good. The city eats secrets fast enough without help.',
      memorySentence: 'You delivered Io\'s blue packet with the seal unbroken.',
    }),
    [IO_PACKET_OUTCOME.opened]: Object.freeze({
      id: 'io.packetChoice.opened',
      speaker: 'io',
      text: 'Wax breaks louder than most bells. Remember that before you call it private.',
      memorySentence: 'You opened Io\'s blue packet before delivery.',
    }),
  }),

  returningSession: Object.freeze({
    [IO_PACKET_OUTCOME.sealed]: Object.freeze({
      id: 'io.returningSession.sealed',
      speaker: 'io',
      requiredMemory: {
        packetOutcome: IO_PACKET_OUTCOME.sealed,
      },
      text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    }),
    [IO_PACKET_OUTCOME.opened]: Object.freeze({
      id: 'io.returningSession.opened',
      speaker: 'io',
      requiredMemory: {
        packetOutcome: IO_PACKET_OUTCOME.opened,
      },
      text: 'You came back. The seal did not. I can use one of those facts.',
    }),
    [IO_PACKET_OUTCOME.unknown]: Object.freeze({
      id: 'io.returningSession.unknown',
      speaker: 'io',
      requiredMemory: {
        packetOutcome: IO_PACKET_OUTCOME.unknown,
      },
      text: 'Back again. Empty ledger, familiar face. We start with the face.',
    }),
  }),

  returnReason: Object.freeze({
    [IO_RETURN_TONE.kind]: Object.freeze({
      id: 'io.returnReason.kind',
      speaker: 'io',
      text: 'Kind answer. Dangerous tool. Keep it sharp.',
    }),
    [IO_RETURN_TONE.evasive]: Object.freeze({
      id: 'io.returnReason.evasive',
      speaker: 'io',
      text: 'That is not an answer. It is a tarp over one. Fine. Vey runs on tarps.',
    }),
    [IO_RETURN_TONE.blunt]: Object.freeze({
      id: 'io.returnReason.blunt',
      speaker: 'io',
      text: 'Blunt is useful. So is a knife. Point it away from the mail.',
    }),
    [IO_RETURN_TONE.silent]: Object.freeze({
      id: 'io.returnReason.silent',
      speaker: 'io',
      text: 'Silence noted. Not trusted. Not wasted.',
    }),
  }),
});

export function getIoPacketResult(outcome) {
  return ioMemoryDialogue.packetChoice[outcome] ?? null;
}

export function getIoReturningLine(memory = {}) {
  const outcome = memory.packetOutcome ?? IO_PACKET_OUTCOME.unknown;
  return ioMemoryDialogue.returningSession[outcome] ?? ioMemoryDialogue.returningSession[IO_PACKET_OUTCOME.unknown];
}

export function getIoReturnReasonLine(tone) {
  return ioMemoryDialogue.returnReason[tone] ?? ioMemoryDialogue.returnReason[IO_RETURN_TONE.silent];
}
