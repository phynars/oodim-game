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

export const IO_RETURNING_RECOGNITION_LINES: Record<PacketOutcome, string> = {
  sealed: "You came back. So did the blue seal, unbroken. That's two facts I can trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
};

export function getIoReturningRecognitionLine(packetOutcome: PacketOutcome): string {
  return IO_RETURNING_RECOGNITION_LINES[packetOutcome];
}

export function getIoRouteMemoryLine(routeBehavior: RouteBehavior): string {
  return routeBehavior === "listened" ? IO_LINES.routeListened : IO_LINES.routeSkipped;
}
