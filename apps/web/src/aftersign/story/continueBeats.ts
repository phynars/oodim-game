export type AftersignDialogueRole = 'io' | 'player' | 'sign' | 'system';

export type AftersignContinueLine = {
  readonly id: string;
  readonly role: AftersignDialogueRole;
  readonly text: string;
};

export type AftersignContinueChoice = {
  readonly id: 'kind' | 'evasive' | 'blunt';
  readonly label: string;
  readonly playerLine: string;
  readonly ioReply: string;
  readonly rememberedPosture: string;
};

export type AftersignContinueBeat = {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly AftersignContinueLine[];
  readonly choices?: readonly AftersignContinueChoice[];
};

export const returnToneChoices: readonly AftersignContinueChoice[] = [
  {
    id: 'kind',
    label: 'Tell Io the city felt less empty with a job in your hand.',
    playerLine: 'It felt less empty when I had somewhere to carry it.',
    ioReply: 'Useful answer. Almost tender. Do not let the city overcharge you for that.',
    rememberedPosture: 'Io remembers the player admitted the work made the city feel less empty.',
  },
  {
    id: 'evasive',
    label: 'Say you came back because the route was still open.',
    playerLine: 'The route was still open. I followed it back.',
    ioReply: 'Routes do not summon people. They only accuse them of standing still.',
    rememberedPosture: 'Io remembers the player hid their reason for returning behind the route.',
  },
  {
    id: 'blunt',
    label: 'Say you wanted to know what the packet changed.',
    playerLine: 'I wanted to know what changed after the packet moved.',
    ioReply: 'Good. Curiosity is dangerous. So is sleepwalking. I prefer the first hazard.',
    rememberedPosture: 'Io remembers the player came back to measure the consequence of the delivery.',
  },
] as const;

export const aftersignContinueBeats: readonly AftersignContinueBeat[] = [
  {
    id: 'io-return-tone',
    title: 'Why the player came back',
    lines: [
      {
        id: 'io-return-tone-ask',
        role: 'io',
        text: 'You returned after the city had time to misplace you. Tell me why.',
      },
    ],
    choices: returnToneChoices,
  },
  {
    id: 'io-next-job',
    title: 'The next job',
    lines: [
      {
        id: 'io-next-job-ledger',
        role: 'io',
        text: 'First job tells me whether your hands wander. Second tells me whether your feet do.',
      },
      {
        id: 'io-next-job-packet',
        role: 'system',
        text: 'Io slides a thin brass token across the counter. It is warm from someone else holding it too long.',
      },
      {
        id: 'io-next-job-route',
        role: 'io',
        text: 'Take this to Saint Orra above the old pharmacy. If she calls you by a name, do not answer quickly.',
      },
      {
        id: 'io-next-job-stake',
        role: 'io',
        text: 'Some names are hooks. Some are doors. Tonight you carry one and learn which it is.',
      },
    ],
  },
] as const;

export function getReturnToneChoice(choiceId: AftersignContinueChoice['id']): AftersignContinueChoice {
  const choice = returnToneChoices.find((candidate) => candidate.id === choiceId);

  if (!choice) {
    throw new Error(`Unknown AFTERSIGN return tone choice: ${choiceId}`);
  }

  return choice;
}

export function getAftersignContinueBeat(beatId: AftersignContinueBeat['id']): AftersignContinueBeat {
  const beat = aftersignContinueBeats.find((candidate) => candidate.id === beatId);

  if (!beat) {
    throw new Error(`Unknown AFTERSIGN continue beat: ${beatId}`);
  }

  return beat;
}
