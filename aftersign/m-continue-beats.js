// AFTERSIGN M-CONTINUE story beats.
// Player-visible intent: after Io's return recognition, the scene continues
// into a return-tone choice and Io's next job offer.

export const M_CONTINUE_BEAT_IDS = Object.freeze({
  RETURN_TONE_CHOICE: "return-tone-choice",
  IO_NEXT_JOB_OFFER: "io-next-job-offer",
});

export const RETURN_TONE_CHOICES = Object.freeze([
  {
    id: "tone-kind",
    label: "Tell Io you came back because someone should.",
    posture: "kind",
    ioMemory: "You came back like the city was owed an answer.",
  },
  {
    id: "tone-evasive",
    label: "Say the rain turned you around.",
    posture: "evasive",
    ioMemory: "You came back and blamed the weather. Useful lie. Small one.",
  },
  {
    id: "tone-blunt",
    label: "Say you came back for the next job.",
    posture: "blunt",
    ioMemory: "You came back hungry for work. I can respect a clean edge.",
  },
]);

export const M_CONTINUE_BEATS = Object.freeze({
  [M_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE]: {
    id: M_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE,
    title: "The kettle clicks once. Empty.",
    narration:
      "Io shuts the ledger on your first delivery. The kiosk signs keep whispering your route like they are afraid to forget it.",
    ioLine: "You returned. That matters less than why. Pick the cleaner answer.",
    choices: RETURN_TONE_CHOICES,
  },
  [M_CONTINUE_BEAT_IDS.IO_NEXT_JOB_OFFER]: {
    id: M_CONTINUE_BEAT_IDS.IO_NEXT_JOB_OFFER,
    title: "Io slides a brass claim tag across the counter.",
    narration:
      "The tag is warm from someone else's hand. A moth-white bell mark glows under the grime: ORRA / PHARMACY / NAME DEBT.",
    ioLine:
      "Next job. Saint Orra has a name she wants carried to the Bell Archive. Names bruise. Carry this one anyway.",
    choices: Object.freeze([
      {
        id: "accept-orra-name",
        label: "Take the claim tag.",
        nextBeat: "orra-name-debt",
      },
      {
        id: "ask-who-it-hurts",
        label: "Ask who the name hurts.",
        nextBeat: "orra-name-debt",
      },
    ]),
  },
});

export function getReturnToneChoice(choiceId) {
  return RETURN_TONE_CHOICES.find((choice) => choice.id === choiceId) ?? null;
}

export function buildIoNextJobLine(choiceId) {
  const choice = getReturnToneChoice(choiceId);
  if (!choice) {
    return M_CONTINUE_BEATS[M_CONTINUE_BEAT_IDS.IO_NEXT_JOB_OFFER].ioLine;
  }

  return `${choice.ioMemory} Next job: Saint Orra has a name she wants carried to the Bell Archive. Names bruise. Carry this one anyway.`;
}
