// AFTERSIGN — Io memory dialogue
// Story-first dialogue data and tiny selectors for the served slice to import.
// Keep lines short. Io notices, weighs, and puts the fact to work.

export const IO_TONE_CHOICES = Object.freeze([
  {
    id: 'kind',
    label: 'Kind',
    prompt: 'I came back because you were waiting.',
    reply: 'Careful. Say that in Vey and someone hands you a debt with a ribbon on it.'
  },
  {
    id: 'evasive',
    label: 'Evasive',
    prompt: 'I was nearby.',
    reply: 'No one is nearby after dark. But you came through the rain, so I will count it.'
  },
  {
    id: 'blunt',
    label: 'Blunt',
    prompt: 'You had another job.',
    reply: 'Good. Honesty is ugly, portable, and hard to counterfeit.'
  }
]);

export const IO_MEMORY_LINES = Object.freeze({
  sealed: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  opened: 'You came back. The seal did not. I can use one of those facts.',
  returned: 'You came back empty-handed. Empty hands still tell me which way the flood ran.',
  withheld: 'You kept the packet. That is not trust. It is a receipt I can read.',
  unknown: 'You came back. I do not yet know what else came with you.'
});

export const IO_ROUTE_MEMORY_LINES = Object.freeze({
  listened: 'You listened before you ran. Rare habit. Keep it.',
  skipped: 'You found the box anyway. Next time, let me finish saving your life.',
  unknown: 'You crossed the Stair and survived. I will decide later whether that was skill.'
});

export const IO_CONTINUATION_BEATS = Object.freeze([
  {
    id: 'io-return-tone-choice',
    speaker: 'Io Vale',
    line: 'Before I give you the next job, answer plain: why come back?',
    choices: IO_TONE_CHOICES
  },
  {
    id: 'io-second-ledger',
    speaker: 'Io Vale',
    line: 'The city keeps two ledgers. One for packages. One for people who return when nobody paid them to.',
    continueLabel: 'Take the next mark'
  },
  {
    id: 'io-next-job',
    speaker: 'Io Vale',
    line: 'Moth Pier lost a boat-name. Saint Orra says it is still bleeding light. Take this red tag and do not let Niko see it first.',
    continueLabel: 'Accept the red tag'
  }
]);

const normalizeOutcome = (outcome) => {
  if (!outcome) return 'unknown';
  if (Object.prototype.hasOwnProperty.call(IO_MEMORY_LINES, outcome)) return outcome;
  return 'unknown';
};

const normalizeRouteMemory = (routeMemory) => {
  if (!routeMemory) return 'unknown';
  if (Object.prototype.hasOwnProperty.call(IO_ROUTE_MEMORY_LINES, routeMemory)) return routeMemory;
  return 'unknown';
};

const normalizeTone = (tone) => {
  const match = IO_TONE_CHOICES.find((choice) => choice.id === tone);
  return match ?? IO_TONE_CHOICES[0];
};

export function getIoReturnRecognition({ packetOutcome, routeMemory } = {}) {
  return [
    {
      id: 'io-return-recognition',
      speaker: 'Io Vale',
      line: IO_MEMORY_LINES[normalizeOutcome(packetOutcome)]
    },
    {
      id: 'io-route-memory',
      speaker: 'Io Vale',
      line: IO_ROUTE_MEMORY_LINES[normalizeRouteMemory(routeMemory)]
    }
  ];
}

export function getIoToneReply(tone) {
  const choice = normalizeTone(tone);
  return {
    id: `io-tone-reply-${choice.id}`,
    speaker: 'Io Vale',
    line: choice.reply,
    rememberedTone: choice.id
  };
}

export function getIoContinuationScript({ packetOutcome, routeMemory, tone } = {}) {
  return [
    ...getIoReturnRecognition({ packetOutcome, routeMemory }),
    IO_CONTINUATION_BEATS[0],
    getIoToneReply(tone),
    ...IO_CONTINUATION_BEATS.slice(1)
  ];
}

export default {
  IO_TONE_CHOICES,
  IO_MEMORY_LINES,
  IO_ROUTE_MEMORY_LINES,
  IO_CONTINUATION_BEATS,
  getIoReturnRecognition,
  getIoToneReply,
  getIoContinuationScript
};
