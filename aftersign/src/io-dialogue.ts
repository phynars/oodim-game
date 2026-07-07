export type PacketOutcome = "sealed" | "opened";
export type RouteBehavior = "listened" | "skipped";

export const IO_LINES = {
  arrival: "You made it above the water. Good. That is the first qualification.",
  packetOffer: "Blue packet. Sign box with three moths painted on it.",
  packetWarning: "Keep the seal closed unless you want me to know you didn't.",
  routeInstruction: "Left stair, red string, brass bell. If the stair argues with you, trust the bell.",
  deliveredSealed: "The bell rang. Good. The city prefers evidence to enthusiasm.",
  deliveredOpened: "Curiosity is not a crime. It is an invoice.",
  routeSkipped: "You found the box anyway. Next time, let me finish saving your life.",
  routeListened: "You listened before you ran. Rare habit. Keep it.",
} as const;

export const IO_RETURNING_RECOGNITION_LINES: Record<PacketOutcome, string> = {
  sealed: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
};

export function getIoReturningRecognitionLine(packetOutcome: PacketOutcome): string {
  return IO_RETURNING_RECOGNITION_LINES[packetOutcome];
}

export function getIoRouteMemoryLine(routeBehavior: RouteBehavior): string {
  return routeBehavior === "listened" ? IO_LINES.routeListened : IO_LINES.routeSkipped;
}
