// AFTERSIGN authored NPC dialogue surface.
// Keep this module runnable and importable from the served page; no prose-only flagship copy.

export const IO_TONE_CHOICES = Object.freeze({
  KIND: 'kind',
  EVASIVE: 'evasive',
  BLUNT: 'blunt',
});

export const IO_PACKET_OUTCOMES = Object.freeze({
  SEALED: 'sealed',
  OPENED: 'opened',
  UNKNOWN: 'unknown',
});

export const IO_MEMORY_DIALOGUE = Object.freeze({
  greeting: 'Night Post is closed to excuses. Open to couriers.',
  packetOffer: 'Blue seal. Silt Stair box. Do not improve the message on the way.',
  routeHint: 'Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.',
  listenedBeforeLeaving: 'You listened before you ran. Rare habit. Keep it.',
  skippedRoute: 'You found the box anyway. Next time, let me finish saving your life.',
  returnRecognition: Object.freeze({
    [IO_PACKET_OUTCOMES.SEALED]: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
    [IO_PACKET_OUTCOMES.OPENED]: 'You came back. The seal did not. I can use one of those facts.',
    [IO_PACKET_OUTCOMES.UNKNOWN]: 'You came back. I have one fact. Bring me another.',
  }),
  returnTonePrompt: 'Tell me why you came back.',
  returnToneChoices: Object.freeze({
    [IO_TONE_CHOICES.KIND]: 'Someone has to keep the lights answering.',
    [IO_TONE_CHOICES.EVASIVE]: 'Still deciding what kind of mistake this is.',
    [IO_TONE_CHOICES.BLUNT]: 'You had another job. Say it.',
  }),
  returnToneReplies: Object.freeze({
    [IO_TONE_CHOICES.KIND]: 'Careful. Vey eats kind couriers first. Still—useful answer.',
    [IO_TONE_CHOICES.EVASIVE]: 'Good. Honest would have worried me less, but good.',
    [IO_TONE_CHOICES.BLUNT]: 'There. A courier who can name the hook before it enters them.',
  }),
  nextJobHandOff: 'Moth Pier lost a boat name. Take the blank tag. Bring back what answers.',
});

export function getIoReturnRecognition(packetOutcome = IO_PACKET_OUTCOMES.UNKNOWN) {
  return IO_MEMORY_DIALOGUE.returnRecognition[packetOutcome] ?? IO_MEMORY_DIALOGUE.returnRecognition[IO_PACKET_OUTCOMES.UNKNOWN];
}

export function getIoReturnToneReply(toneChoice) {
  return IO_MEMORY_DIALOGUE.returnToneReplies[toneChoice] ?? IO_MEMORY_DIALOGUE.returnToneReplies[IO_TONE_CHOICES.EVASIVE];
}

export function buildIoReturnSequence({ packetOutcome = IO_PACKET_OUTCOMES.UNKNOWN, toneChoice = IO_TONE_CHOICES.EVASIVE } = {}) {
  return [
    getIoReturnRecognition(packetOutcome),
    IO_MEMORY_DIALOGUE.returnTonePrompt,
    getIoReturnToneReply(toneChoice),
    IO_MEMORY_DIALOGUE.nextJobHandOff,
  ];
}
