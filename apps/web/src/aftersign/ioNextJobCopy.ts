export type IoPacketOutcome = "sealed" | "opened";
export type IoReturnTone = "kind" | "evasive" | "blunt";

export interface IoReturnToneOption {
  readonly tone: IoReturnTone;
  readonly label: string;
  readonly playerLine: string;
  readonly ioReply: string;
}

export interface IoNextJobCopy {
  readonly beatId: "io-next-job-handoff";
  readonly prompt: string;
  readonly options: readonly IoReturnToneOption[];
  readonly handoff: {
    readonly sealed: readonly string[];
    readonly opened: readonly string[];
  };
  readonly routeMarks: readonly string[];
}

export const ioNextJobCopy: IoNextJobCopy = {
  beatId: "io-next-job-handoff",
  prompt: "Io studies you like a route map gone damp at the edges. \"You came back. Why?\"",
  options: [
    {
      tone: "kind",
      label: "I said I would.",
      playerLine: "I said I would.",
      ioReply: "A promise is a small bridge. Most people notice it after it falls."
    },
    {
      tone: "evasive",
      label: "The stairs led here.",
      playerLine: "The stairs led here.",
      ioReply: "Stairs lead plenty of places. You chose the one with a witness."
    },
    {
      tone: "blunt",
      label: "You have more work.",
      playerLine: "You have more work.",
      ioReply: "Correct. Ugly answer, useful spine."
    }
  ],
  handoff: {
    sealed: [
      "Io sets the blue packet on the counter, seal unbroken, and turns it until the wax catches lanternlight.",
      "\"Saint Orra is awake over the old pharmacy. She remembers a name someone paid to lose.\"",
      "\"Carry it to the Bell Archive. Do not promise mercy until you know who it costs.\""
    ],
    opened: [
      "Io sets the opened packet on the counter. The torn wax looks darker than it should.",
      "\"Saint Orra is awake over the old pharmacy. She remembers a name someone paid to lose.\"",
      "\"Carry it to the Bell Archive. And this time, leave the dead paper dead until it is addressed.\""
    ]
  },
  routeMarks: [
    "Follow the moth-white pharmacy sign below the Silt Stair.",
    "If the bells start before you arrive, stop walking.",
    "If Niko offers a dry shortcut, ask who stayed wet."
  ]
};

export function getIoNextJobLines(packetOutcome: IoPacketOutcome): readonly string[] {
  return ioNextJobCopy.handoff[packetOutcome];
}

export function getIoReturnToneReply(tone: IoReturnTone): string {
  return ioNextJobCopy.options.find((option) => option.tone === tone)?.ioReply ?? ioNextJobCopy.options[0].ioReply;
}
