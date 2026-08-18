export type ReturnToneChoiceId = "soft" | "wry" | "hard";

export type ReturnToneChoice = {
  id: ReturnToneChoiceId;
  label: string;
  ioReply: string;
};

export const RETURN_TONE_BEAT_ID = "return-tone";
export const NEXT_JOB_BEAT_ID = "next-job";

export const RETURN_TONE_PROMPT =
  "Io watches the name settle between you. How do you answer being remembered?";

export const RETURN_TONE_CHOICES: readonly ReturnToneChoice[] = [
  {
    id: "soft",
    label: "Like you were keeping a light on.",
    ioReply:
      "Then I did not waste the power. Good. Take the west stair before it forgets it is a stair.",
  },
  {
    id: "wry",
    label: "Like the city finally learned manners.",
    ioReply:
      "Careful. Manners are what the city wears when it is hiding teeth. Still — it heard you.",
  },
  {
    id: "hard",
    label: "Like proof I was here.",
    ioReply:
      "Proof cuts both ways. Keep yours sharp. Someone below is erasing the rest.",
  },
];

export const NEXT_JOB_COPY = {
  title: "Io's next job",
  line:
    "Under the transit hall, a dead mailbox is still breathing. Bring me the last packet before Orra's name goes blank.",
  cta: "Take the west stair",
} as const;

export function getReturnToneChoice(choiceId: ReturnToneChoiceId): ReturnToneChoice {
  const choice = RETURN_TONE_CHOICES.find((candidate) => candidate.id === choiceId);

  if (!choice) {
    throw new Error(`Unknown return tone choice: ${choiceId}`);
  }

  return choice;
}
