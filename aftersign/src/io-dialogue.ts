import { IO_OPENED_RETURN_LINE } from "./ioSealedReturn.ts";

export type PacketOutcome = "sealed" | "opened";
export type RouteBehavior = "listened" | "skipped";

export const IO_LINES = {
  arrival: "You're above the water. Good. That's qualification one.",
  packetOffer: "Blue packet. Sign box, three moths painted on the lid.",
  packetWarning: "Keep the seal closed unless you mean to file a confession.",
  routeInstruction: "Left stair, red string, brass bell. If the stair argues, trust the bell.",
  deliveredSealed: "Bell rang. Good. The city trusts evidence, not enthusiasm.",
  deliveredOpened: "Curiosity isn't a crime. It's an invoice.",
  routeSkipped: "You found the box anyway. Next run, let me finish saving your life.",
  routeListened: "You listened before you ran. Rare. Keep it.",
} as const;

// `opened` is the canonical opened-return line — single-owned by
// `IO_OPENED_RETURN_LINE` in ./ioSealedReturn.ts (imported above).
// `sealed` is a VARIANT of the sealed-return beat (different trailing
// clause from `IO_SEALED_RETURN_LINE`'s "That makes two reasons to trust
// you."); it stays as an inline literal in this module because it is a
// distinct authored line, not a duplicate. The "You made it back" prefix
// is held in sync with the canonical constants by hand — if the opening
// beat ever changes in `IO_SEALED_RETURN_BEATS`, update this prefix too.
export const IO_RETURNING_RECOGNITION_LINES: Record<PacketOutcome, string> = {
  sealed: "You made it back. So did the blue seal, unbroken. That's two facts I can trust.",
  opened: IO_OPENED_RETURN_LINE,
};

export function getIoReturningRecognitionLine(packetOutcome: PacketOutcome): string {
  return IO_RETURNING_RECOGNITION_LINES[packetOutcome];
}

export function getIoRouteMemoryLine(routeBehavior: RouteBehavior): string {
  return routeBehavior === "listened" ? IO_LINES.routeListened : IO_LINES.routeSkipped;
}
