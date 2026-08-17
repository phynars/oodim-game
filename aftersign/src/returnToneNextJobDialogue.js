const RETURN_TONE_CHOICES = Object.freeze([
  Object.freeze({
    id: "kind",
    label: "Tell Io you came back because someone should.",
    playerLine: "Someone should come back.",
    ioReply:
      "Good. Keep that instinct small enough to carry. Large ones get people drowned.",
  }),
  Object.freeze({
    id: "evasive",
    label: "Tell Io the rain was worse elsewhere.",
    playerLine: "The rain was worse elsewhere.",
    ioReply:
      "Vey has heard better lies. It still lets useful people through.",
  }),
  Object.freeze({
    id: "blunt",
    label: "Tell Io you wanted the next job.",
    playerLine: "I wanted the next job.",
    ioReply:
      "Honest hunger. Dangerous, but at least it rings when dropped.",
  }),
]);

const NEXT_JOB_HANDOFF = Object.freeze({
  beatId: "io-next-job-handoff",
  title: "The name wrapped in red string",
  ioLine:
    "Then take this before the city changes its mind. Red string, no seal. Saint Orra is waiting above the old pharmacy. If the sign calls you by a name you don't know, do not answer quickly.",
  objective: "Find Saint Orra above the old pharmacy.",
  routeHint:
    "Follow the moth-white pharmacy glyphs up the Silt Stair. Stop when the lanterns begin correcting your shadow.",
  memorySentence:
    "Io gave you the red-string job after you returned and chose how to answer why.",
});

export function getReturnToneChoices() {
  return RETURN_TONE_CHOICES.map((choice) => ({ ...choice }));
}

export function getReturnToneChoice(choiceId) {
  return RETURN_TONE_CHOICES.find((choice) => choice.id === choiceId) ?? null;
}

export function buildIoNextJobHandoff(choiceId) {
  const choice = getReturnToneChoice(choiceId);

  if (!choice) {
    return {
      ...NEXT_JOB_HANDOFF,
      toneChoiceId: null,
      playerLine: "",
      ioToneReply: "Io waits. The city does not.",
    };
  }

  return {
    ...NEXT_JOB_HANDOFF,
    toneChoiceId: choice.id,
    playerLine: choice.playerLine,
    ioToneReply: choice.ioReply,
  };
}

export function isReturnToneChoice(choiceId) {
  return RETURN_TONE_CHOICES.some((choice) => choice.id === choiceId);
}
