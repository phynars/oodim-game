export type AftersignReturnTone = "soft" | "wary" | "defiant";

export type AftersignReturnToneChoice = {
  readonly id: AftersignReturnTone;
  readonly label: string;
  readonly ioReply: string;
};

export type AftersignNextJobCopy = {
  readonly beatId: "return-tone-choice" | "io-next-job";
  readonly speaker: "Io";
  readonly text: string;
};

export const AFTERSIGN_RETURN_TONE_CHOICES: readonly AftersignReturnToneChoice[] = [
  {
    id: "soft",
    label: "Tell Io you came back because she asked.",
    ioReply:
      "Then I will be careful with what I ask next. The city keeps its debts. So do I.",
  },
  {
    id: "wary",
    label: "Tell Io you came back because the city changed.",
    ioReply:
      "It changed because you touched it. That is not blame. Not yet.",
  },
  {
    id: "defiant",
    label: "Tell Io you came back to finish the job.",
    ioReply:
      "Good. Keep that edge. The next door only opens for people who still have one.",
  },
] as const;

export const AFTERSIGN_NEXT_JOB_COPY: readonly AftersignNextJobCopy[] = [
  {
    beatId: "return-tone-choice",
    speaker: "Io",
    text:
      "Before the packet sleeps, answer one thing: when you returned, what did you bring back with you?",
  },
  {
    beatId: "io-next-job",
    speaker: "Io",
    text:
      "There is another address under the west signal tower. No name, no light, just a door that remembers footsteps. Take this marker there. If it speaks your name, do not answer first.",
  },
] as const;

export function resolveAftersignReturnToneReply(tone: AftersignReturnTone): string {
  return AFTERSIGN_RETURN_TONE_CHOICES.find((choice) => choice.id === tone)?.ioReply ?? "";
}
