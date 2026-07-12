export type IoFirstSessionBeatId =
  | "arrival"
  | "name"
  | "packet"
  | "promise";

export interface IoFirstSessionCopyLine {
  beatId: IoFirstSessionBeatId;
  speaker: "io";
  text: string;
}

export const ioFirstSessionCopy: readonly IoFirstSessionCopyLine[] = [
  {
    beatId: "arrival",
    speaker: "io",
    text: "You're inside the dead-letter office. Don't run—every unopened packet here is listening.",
  },
  {
    beatId: "name",
    speaker: "io",
    text: "I'm Io. I remember routes, names, and the tiny ways people decide whether to trust a signal.",
  },
  {
    beatId: "packet",
    speaker: "io",
    text: "Seal one packet for me. Not because it's safe—because someone on the other side still matters.",
  },
  {
    beatId: "promise",
    speaker: "io",
    text: "When you come back, I'll know which signal you chose. That's the first rule here: nothing kind gets lost for free.",
  },
] as const;

export function getIoFirstSessionLine(
  beatId: IoFirstSessionBeatId,
): IoFirstSessionCopyLine {
  const line = ioFirstSessionCopy.find((copyLine) => copyLine.beatId === beatId);

  if (!line) {
    throw new Error(`Unknown Io first-session beat: ${beatId satisfies never}`);
  }

  return line;
}

export function getIoFirstSessionText(beatId: IoFirstSessionBeatId): string {
  return getIoFirstSessionLine(beatId).text;
}
