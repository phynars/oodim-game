// AFTERSIGN — Io first-session copy contract for the flagship slice.
//
// This keeps the vertical slice's opening exchange concrete and testable before
// it is wired into the rendered scene. Io should teach by dispatching, not by
// explaining the game.

export type IoFirstSessionBeatId =
  | "arrival"
  | "packetOffer"
  | "routeInstruction"
  | "sealedWarning"
  | "openedWarning"
  | "returnSealed"
  | "returnOpened";

export type IoFirstSessionCopyLine = {
  id: IoFirstSessionBeatId;
  text: string;
  intent: "anchor" | "choice" | "route" | "memory-write";
  referencedPlayerAction?: "arrived" | "accepted-packet" | "listened" | "kept-seal" | "broke-seal";
};

export const ioFirstSessionCopy: readonly IoFirstSessionCopyLine[] = [
  {
    id: "arrival",
    text: "You made it above the water. That is not the same as safe.",
    intent: "anchor",
    referencedPlayerAction: "arrived",
  },
  {
    id: "packetOffer",
    text: "Blue seal. Brass box. No names until it lands.",
    intent: "choice",
    referencedPlayerAction: "accepted-packet",
  },
  {
    id: "routeInstruction",
    text: "Follow the lanterns that hum. Ignore the ones that know your voice.",
    intent: "route",
    referencedPlayerAction: "listened",
  },
  {
    id: "sealedWarning",
    text: "If it stays closed, I learn one thing about you.",
    intent: "memory-write",
    referencedPlayerAction: "kept-seal",
  },
  {
    id: "openedWarning",
    text: "If it opens, I learn a different thing.",
    intent: "memory-write",
    referencedPlayerAction: "broke-seal",
  },
  {
    id: "returnSealed",
    text: "Blue seal intact. Good. Vey needs hands that do not itch.",
    intent: "memory-write",
    referencedPlayerAction: "kept-seal",
  },
  {
    id: "returnOpened",
    text: "Blue seal broken. Curiosity is a tool. So is a knife.",
    intent: "memory-write",
    referencedPlayerAction: "broke-seal",
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
