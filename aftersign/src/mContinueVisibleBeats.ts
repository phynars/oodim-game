export type MContinueBeatId =
  | 'io-return-recognition'
  | 'return-tone-choice'
  | 'return-tone-reply'
  | 'io-next-job-handoff';

export type ReturnTone = 'kind' | 'evasive' | 'blunt';

export interface MContinueBeat {
  id: MContinueBeatId;
  speaker: 'Io' | 'Player';
  text: string;
  choices?: MContinueChoice[];
}

export interface MContinueChoice {
  tone: ReturnTone;
  label: string;
  reply: string;
}

export interface MContinueState {
  beat: MContinueBeatId;
  selectedTone: ReturnTone | null;
  beatsSeen: MContinueBeatId[];
}

const RETURN_TONE_CHOICES: MContinueChoice[] = [
  {
    tone: 'kind',
    label: 'I came back because you trusted me.',
    reply: 'Careful. Say that too often and I will start assigning you the honest work.',
  },
  {
    tone: 'evasive',
    label: 'I had nowhere better to be.',
    reply: 'That is almost an answer. The city runs on almost, when it has to.',
  },
  {
    tone: 'blunt',
    label: 'You still owe me the next route.',
    reply: 'Good. Want is cleaner than sentiment. Take the stair mark before it fades.',
  },
];

const BEAT_COPY: Record<MContinueBeatId, Omit<MContinueBeat, 'choices'>> = {
  'io-return-recognition': {
    id: 'io-return-recognition',
    speaker: 'Io',
    text: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  },
  'return-tone-choice': {
    id: 'return-tone-choice',
    speaker: 'Io',
    text: 'Most couriers vanish after the first honest delivery. Tell me why you did not.',
  },
  'return-tone-reply': {
    id: 'return-tone-reply',
    speaker: 'Io',
    text: '',
  },
  'io-next-job-handoff': {
    id: 'io-next-job-handoff',
    speaker: 'Io',
    text: 'Next job: Saint Orra is awake over the old pharmacy. Carry this moth-white name before the stair forgets where it ends.',
  },
};

export function createMContinueState(): MContinueState {
  return {
    beat: 'io-return-recognition',
    selectedTone: null,
    beatsSeen: ['io-return-recognition'],
  };
}

export function currentMContinueBeat(state: MContinueState): MContinueBeat {
  if (state.beat === 'return-tone-choice') {
    return {
      ...BEAT_COPY['return-tone-choice'],
      choices: RETURN_TONE_CHOICES.map((choice) => ({ ...choice })),
    };
  }

  if (state.beat === 'return-tone-reply') {
    const selected = RETURN_TONE_CHOICES.find((choice) => choice.tone === state.selectedTone);
    return {
      ...BEAT_COPY['return-tone-reply'],
      text: selected?.reply ?? 'Io waits for the answer instead of inventing one for you.',
    };
  }

  return { ...BEAT_COPY[state.beat] };
}

export function advanceMContinue(state: MContinueState): MContinueState {
  if (state.beat === 'io-return-recognition') {
    return markSeen({ ...state, beat: 'return-tone-choice' });
  }

  if (state.beat === 'return-tone-reply') {
    return markSeen({ ...state, beat: 'io-next-job-handoff' });
  }

  return state;
}

export function chooseMContinueTone(state: MContinueState, tone: ReturnTone): MContinueState {
  if (state.beat !== 'return-tone-choice') {
    return state;
  }

  return markSeen({
    ...state,
    beat: 'return-tone-reply',
    selectedTone: tone,
  });
}

export function isMContinueComplete(state: MContinueState): boolean {
  return state.beat === 'io-next-job-handoff' && state.beatsSeen.includes('return-tone-reply');
}

export function getMContinueChoices(): MContinueChoice[] {
  return RETURN_TONE_CHOICES.map((choice) => ({ ...choice }));
}

function markSeen(state: MContinueState): MContinueState {
  if (state.beatsSeen.includes(state.beat)) {
    return state;
  }

  return {
    ...state,
    beatsSeen: [...state.beatsSeen, state.beat],
  };
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkMContinueVisibleBeatFlow(): void {
  let state = createMContinueState();
  assert(currentMContinueBeat(state).id === 'io-return-recognition', 'starts at Io return recognition');

  state = advanceMContinue(state);
  const toneBeat = currentMContinueBeat(state);
  assert(toneBeat.id === 'return-tone-choice', 'second beat is the return-tone choice');
  assert(toneBeat.choices?.length === 3, 'return-tone choice exposes three visible options');

  state = chooseMContinueTone(state, 'kind');
  assert(currentMContinueBeat(state).id === 'return-tone-reply', 'tone tap advances to Io reply');
  assert(currentMContinueBeat(state).text.includes('honest work'), 'kind tone has a concrete Io reply');

  state = advanceMContinue(state);
  assert(currentMContinueBeat(state).id === 'io-next-job-handoff', 'reply advances to next-job handoff');
  assert(isMContinueComplete(state), 'flow is complete after next-job handoff is visible');
}

export function runMContinueVisibleBeatChecks(): void {
  checkMContinueVisibleBeatFlow();
}
