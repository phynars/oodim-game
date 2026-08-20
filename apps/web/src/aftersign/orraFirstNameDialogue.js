export const ORRA_FIRST_NAME_DIALOGUE = Object.freeze({
  id: "orra-first-name",
  speaker: "Saint Orra",
  location: "old-pharmacy-sign",
  premise:
    "A living pharmacy sign asks the courier to carry a forgotten name to the Bell Archive.",
  entryLines: Object.freeze([
    "There you are, little postmark.",
    "No, not that name. The one the city left on you when it ran out of hands.",
    "Come closer. I have kept a hurt warm, and it is beginning to spoil."
  ]),
  offerLines: Object.freeze([
    "A name was paid out of a mouth that loved it.",
    "Maud Underbell keeps the bell that can put it back.",
    "Carry it sealed. Do not rehearse it. Some names wake when admired."
  ]),
  choicePrompt: "Take Orra's name-case?",
  choices: Object.freeze({
    acceptWithoutAsking: Object.freeze({
      id: "accept-without-asking",
      label: "Take it sealed.",
      playerLine: "I'll carry it.",
      orraLine:
        "Good child. Mercy first, questions after — a dangerous order, but tidy."
    }),
    askWhoItHurts: Object.freeze({
      id: "ask-who-it-hurts",
      label: "Ask who it hurts.",
      playerLine: "Who gets hurt if I deliver it?",
      orraLine:
        "Ah. Io sent me a careful one. The answer is yes, which is not an answer, which is Vey."
    }),
    refuse: Object.freeze({
      id: "refuse",
      label: "Refuse the case.",
      playerLine: "Find another courier.",
      orraLine:
        "I have been a sign for ninety years. I know how to wait where guilt can see me."
    })
  }),
  memorySentences: Object.freeze({
    acceptWithoutAsking:
      "You took Orra's name-case without asking who it would hurt.",
    askWhoItHurts:
      "You asked Orra who the restored name would hurt before accepting the case.",
    refuse: "You refused Orra's name-case at the old pharmacy sign."
  }),
  routeHintLines: Object.freeze([
    "Up-stair until the brass gutters sing.",
    "Left at the moth lamp with no moths.",
    "If a bell rings before you knock, lie less loudly."
  ])
});

export function resolveOrraFirstNameDialogue(choiceId) {
  const choice = ORRA_FIRST_NAME_DIALOGUE.choices[choiceId];

  if (!choice) {
    throw new Error(`Unknown Orra first-name choice: ${choiceId}`);
  }

  return Object.freeze({
    beatId: ORRA_FIRST_NAME_DIALOGUE.id,
    speaker: ORRA_FIRST_NAME_DIALOGUE.speaker,
    lines: Object.freeze([
      ...ORRA_FIRST_NAME_DIALOGUE.entryLines,
      ...ORRA_FIRST_NAME_DIALOGUE.offerLines,
      choice.playerLine,
      choice.orraLine,
      ...ORRA_FIRST_NAME_DIALOGUE.routeHintLines
    ]),
    remembered: ORRA_FIRST_NAME_DIALOGUE.memorySentences[choiceId]
  });
}
