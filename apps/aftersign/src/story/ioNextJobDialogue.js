const TONE_CHOICES = Object.freeze({
  steady: Object.freeze({
    id: 'steady',
    label: 'Keep your voice steady.',
    ioReply: 'That is the voice I heard when the room went dark. Hold it. We can use it.',
    memoryLine: 'You came back steady when the dark expected you to flinch.'
  }),
  sharp: Object.freeze({
    id: 'sharp',
    label: 'Tell Io the truth fast.',
    ioReply: 'Good. No velvet on the blade. I can work with truth that arrives breathing hard.',
    memoryLine: 'You came back sharp enough to cut through the static.'
  }),
  soft: Object.freeze({
    id: 'soft',
    label: 'Answer softly.',
    ioReply: 'Soft is not small. Soft got through the wall without teaching it your shape.',
    memoryLine: 'You came back soft, and the room lowered its voice to hear you.'
  })
});

const DEFAULT_PLAYER_NAME = 'Runner';

export function getIoToneChoices() {
  return Object.values(TONE_CHOICES).map(({ id, label }) => ({ id, label }));
}

export function resolveIoToneChoice(choiceId, player = {}) {
  const choice = TONE_CHOICES[choiceId] || TONE_CHOICES.steady;
  const name = normalizeName(player.name);

  return Object.freeze({
    beatId: 'io-return-tone-choice',
    choiceId: choice.id,
    label: choice.label,
    lines: Object.freeze([
      {
        speaker: 'Io',
        text: choice.ioReply
      },
      {
        speaker: 'Io',
        text: `${name}, the courier channel woke up while you were gone. It only opens for someone it has already lost once.`
      },
      {
        speaker: 'Io',
        text: 'Next job: carry my apology to Orra before the sign forgets her address.'
      }
    ]),
    memory: Object.freeze({
      npc: 'Io',
      key: 'return-tone',
      value: choice.memoryLine
    }),
    nextJob: Object.freeze({
      id: 'orra-apology-packet',
      title: 'Carry Io’s apology to Orra.',
      prompt: 'The packet is warm. It knows you came back.'
    })
  });
}

export function buildIoNextJobBeat(memory = {}, player = {}) {
  const name = normalizeName(player.name);
  const rememberedTone = memory['return-tone'] || 'You came back. That is the part the room remembers.';

  return Object.freeze({
    beatId: 'io-next-job-handoff',
    lines: Object.freeze([
      {
        speaker: 'Io',
        text: rememberedTone
      },
      {
        speaker: 'Io',
        text: `${name}, take this packet to Orra. Do not open it unless it starts saying your name.`
      },
      {
        speaker: 'System',
        text: 'New job accepted: Orra is waiting beyond the rainline.'
      }
    ]),
    objective: Object.freeze({
      id: 'reach-orra-rainline',
      label: 'Find Orra beyond the rainline.'
    })
  });
}

function normalizeName(name) {
  if (typeof name !== 'string') {
    return DEFAULT_PLAYER_NAME;
  }

  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_PLAYER_NAME;
}
