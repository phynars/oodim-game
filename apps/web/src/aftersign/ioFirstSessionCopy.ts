// AFTERSIGN — Io first-session copy contract for the flagship slice.
//
// Source of truth: docs/flagship/vertical-slice-script.md.
// Every line here is the authored script text; do not paraphrase. The
// harness (see docs/flagship/story-state-contract.md) asserts these
// beats by id and by fragment, so drift here breaks the slice proof.
//
// Same-session lines cover the first arrival, the job hand-off, and
// the route instruction. Returning-session lines (returnSealed /
// returnOpened) are the primary recognition beats and must reference
// the packet outcome tokens the story-state contract uses: `sealed`
// and `opened`.

export type IoFirstSessionBeatId =
  | "arrival"
  | "packetOffer"
  | "routeInstruction"
  | "sealedWarning"
  | "openedWarning"
  | "returnSealed"
  | "returnOpened";

export type IoReferencedPlayerAction =
  | "arrived"
  | "accepted-packet"
  | "listened"
  | "sealed"
  | "opened";

export type IoFirstSessionCopyLine = {
  id: IoFirstSessionBeatId;
  text: string;
  intent: "anchor" | "choice" | "route" | "memory-write";
  referencedPlayerAction?: IoReferencedPlayerAction;
};

export const ioFirstSessionCopy: readonly IoFirstSessionCopyLine[] = [
  {
    id: "arrival",
    text: "You made it above the water. Good. That is the first qualification.",
    intent: "anchor",
    referencedPlayerAction: "arrived",
  },
  {
    id: "packetOffer",
    text: "Blue packet. Sign box with three moths painted on it.",
    intent: "choice",
    referencedPlayerAction: "accepted-packet",
  },
  {
    id: "routeInstruction",
    text: "Left stair, red string, brass bell. If the stair argues with you, trust the bell.",
    intent: "route",
    referencedPlayerAction: "listened",
  },
  {
    id: "sealedWarning",
    text: "Keep the seal closed unless you want me to know you didn't.",
    intent: "memory-write",
    referencedPlayerAction: "sealed",
  },
  {
    id: "openedWarning",
    text: "Curiosity is not a crime. It is an invoice.",
    intent: "memory-write",
    referencedPlayerAction: "opened",
  },
  {
    id: "returnSealed",
    text: "The bell rang. Good. The city prefers evidence to enthusiasm.",
    intent: "memory-write",
    referencedPlayerAction: "sealed",
  },
  {
    id: "returnOpened",
    text: "No bell. So either the box lied, or you gave it something already spent.",
    intent: "memory-write",
    referencedPlayerAction: "opened",
  },
] as const;

export function getIoFirstSessionLine(id: IoFirstSessionBeatId): IoFirstSessionCopyLine {
  const line = ioFirstSessionCopy.find((candidate) => candidate.id === id);

  if (!line) {
    throw new Error(`Unknown Io first-session beat: ${id}`);
  }

  return line;
}

export function getIoFirstSessionText(id: IoFirstSessionBeatId): string {
  return getIoFirstSessionLine(id).text;
}
