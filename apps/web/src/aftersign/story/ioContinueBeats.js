export const IO_CONTINUE_BEAT_IDS = Object.freeze({
  RETURN_TONE_CHOICE: 'io-return-tone-choice',
  NEXT_JOB_HANDOFF: 'io-next-job-handoff',
});

export const IO_RETURN_TONE_OPTIONS = Object.freeze([
  {
    id: 'kind',
    label: 'I came back because you trusted me.',
    reply:
      'Careful. That sort of answer makes people hand you worse errands.',
  },
  {
    id: 'evasive',
    label: 'I had business nearby.',
    reply:
      'No, you did not. But you came back anyway. I can work with half a truth.',
  },
  {
    id: 'blunt',
    label: 'You still owe me an explanation.',
    reply:
      'Correct. I am paying in useful work, which is the only coin left tonight.',
  },
]);

export const IO_NEXT_JOB_HANDOFF = Object.freeze({
  id: IO_CONTINUE_BEAT_IDS.NEXT_JOB_HANDOFF,
  speaker: 'Io',
  line:
    'Take the red tag to Saint Orra. If the pharmacy sign calls you by the wrong name, answer once and only once.',
  objective: 'Carry Io’s red tag to Saint Orra.',
});

export function getIoReturnToneReply(toneId) {
  return (
    IO_RETURN_TONE_OPTIONS.find((option) => option.id === toneId)?.reply ??
    IO_RETURN_TONE_OPTIONS[1].reply
  );
}

export function buildIoContinueBeats(selectedToneId = 'evasive') {
  return [
    {
      id: IO_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE,
      speaker: 'Io',
      line: getIoReturnToneReply(selectedToneId),
    },
    IO_NEXT_JOB_HANDOFF,
  ];
}
