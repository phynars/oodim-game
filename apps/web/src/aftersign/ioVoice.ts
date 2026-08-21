export type IoPacketOutcome = "sealed" | "opened" | "unknown";
export type IoRouteAttention = "listened" | "skipped";
export type IoReturnTone = "kind" | "evasive" | "blunt";

export const IO_VOICE = {
  greeting: "Night Post is closed to excuses. Open to couriers.",
  packetOffer: "Blue seal. Silt Stair box. Do not improve the message on the way.",
  routeHint:
    "Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.",
  nextJob:
    "Moth Pier next. If the tide engine asks your name, give it mine first.",
} as const;

export const IO_PACKET_RETURN_LINES: Record<IoPacketOutcome, string> = {
  sealed:
    "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  opened: "You came back. The seal did not. I can use one of those facts.",
  unknown: "You came back. I have one fact. Bring me another.",
} as const;

export const IO_ROUTE_ATTENTION_LINES: Record<IoRouteAttention, string> = {
  listened: "You listened before you ran. Rare habit. Keep it.",
  skipped: "You found the box anyway. Next time, let me finish saving your life.",
} as const;

export const IO_RETURN_TONE_LINES: Record<IoReturnTone, string> = {
  kind: "Kind answer. Dangerous tool. Keep it sharp.",
  evasive: "You walked around the truth. I noticed the shape of the room.",
  blunt: "Blunt is useful. So is knowing who bleeds when you swing it.",
} as const;

export function getIoPacketReturnLine(outcome: IoPacketOutcome): string {
  return IO_PACKET_RETURN_LINES[outcome];
}

export function getIoRouteAttentionLine(attention: IoRouteAttention): string {
  return IO_ROUTE_ATTENTION_LINES[attention];
}

export function getIoReturnToneLine(tone: IoReturnTone): string {
  return IO_RETURN_TONE_LINES[tone];
}
