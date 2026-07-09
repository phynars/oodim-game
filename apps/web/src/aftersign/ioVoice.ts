export type IoPacketOutcome = "sealed" | "opened";
export type IoRouteAttention = "listened" | "skipped";

export interface IoRecognitionFacts {
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
}

export interface IoRecognitionLine {
  id: string;
  text: string;
  referencedFact: keyof IoRecognitionFacts;
  referencedValue: string;
}

const PACKET_LINES: Record<IoPacketOutcome, IoRecognitionLine> = {
  sealed: {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    referencedFact: "packetOutcome",
    referencedValue: "sealed",
  },
  opened: {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    referencedFact: "packetOutcome",
    referencedValue: "opened",
  },
};

const ROUTE_LINES: Record<IoRouteAttention, IoRecognitionLine> = {
  listened: {
    id: "io-return-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    referencedFact: "routeAttention",
    referencedValue: "listened",
  },
  skipped: {
    id: "io-return-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    referencedFact: "routeAttention",
    referencedValue: "skipped",
  },
};

export function getIoRecognitionLine(facts: IoRecognitionFacts): IoRecognitionLine | null {
  if (facts.packetOutcome) {
    return PACKET_LINES[facts.packetOutcome];
  }

  if (facts.routeAttention) {
    return ROUTE_LINES[facts.routeAttention];
  }

  return null;
}

export const ioRecognitionLines = {
  packet: PACKET_LINES,
  route: ROUTE_LINES,
} as const;
