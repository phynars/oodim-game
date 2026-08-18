const RETURN_TONE_CHOICES = Object.freeze({
  kind: Object.freeze({
    id: "kind",
    label: "I came back because you trusted me.",
    ioLine:
      "Careful. I trust routes, not people. But you kept one. That is a start.",
  }),
  evasive: Object.freeze({
    id: "evasive",
    label: "I had nowhere better to be.",
    ioLine:
      "Then Vey is improving. It usually waits until the third night to sound better than nowhere.",
  }),
  blunt: Object.freeze({
    id: "blunt",
    label: "I came back for the next job.",
    ioLine:
      "Good. Wanting work is cleaner than pretending this city is calling you home.",
  }),
});

const NEXT_JOB_LINES = Object.freeze({
  intro:
    "Saint Orra woke under the old pharmacy. She has a name stuck in her paint and a temper about it.",
  packet:
    "Take the red tag. Do not read it aloud unless the bells start answering before you ask.",
  route:
    "Moth Pier first. Keep the water on your left until it argues. Then climb.",
  close:
    "And courier—if Orra calls you by a name you do not know, do not correct her yet.",
});

export function getReturnToneChoices() {
  return Object.values(RETURN_TONE_CHOICES).map(({ id, label }) => ({ id, label }));
}

export function getIoReturnToneReply(choiceId) {
  return RETURN_TONE_CHOICES[choiceId]?.ioLine ?? RETURN_TONE_CHOICES.evasive.ioLine;
}

export function getIoNextJobLines() {
  return { ...NEXT_JOB_LINES };
}

export function buildIoContinueDialogue(choiceId) {
  return Object.freeze({
    choiceId: RETURN_TONE_CHOICES[choiceId]?.id ?? "evasive",
    reply: getIoReturnToneReply(choiceId),
    nextJob: getIoNextJobLines(),
  });
}
