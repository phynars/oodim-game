export type PacketOutcome = "sealed" | "opened";
export type RouteAttention = "listened" | "skipped";
export type ReturnTone = "kind" | "evasive" | "blunt";

export interface IoRecognitionMemory {
  readonly packetOutcome: PacketOutcome;
  readonly routeAttention?: RouteAttention;
  readonly returnTone?: ReturnTone;
}

export interface IoRecognitionLine {
  readonly id: string;
  readonly text: string;
}

const PACKET_LINES: Record<PacketOutcome, IoRecognitionLine> = {
  sealed: {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  opened: {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
  },
};

const ROUTE_LINES: Record<RouteAttention, IoRecognitionLine> = {
  listened: {
    id: "io-return-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
  },
  skipped: {
    id: "io-return-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
  },
};

const TONE_LINES: Record<ReturnTone, IoRecognitionLine> = {
  kind: {
    id: "io-return-tone-kind",
    text: "Kind answer. Expensive habit, after dark. Still: noted.",
  },
  evasive: {
    id: "io-return-tone-evasive",
    text: "You dodged the question. Fine. Couriers survive on light feet.",
  },
  blunt: {
    id: "io-return-tone-blunt",
    text: "Blunt answer. Saves ink. Sometimes blood.",
  },
};

export function getIoRecognitionLines(memory: IoRecognitionMemory): readonly IoRecognitionLine[] {
  const lines: IoRecognitionLine[] = [PACKET_LINES[memory.packetOutcome]];

  if (memory.routeAttention) {
    lines.push(ROUTE_LINES[memory.routeAttention]);
  }

  if (memory.returnTone) {
    lines.push(TONE_LINES[memory.returnTone]);
  }

  return lines;
}

export function getIoPrimaryRecognitionLine(memory: IoRecognitionMemory): IoRecognitionLine {
  return getIoRecognitionLines(memory)[0];
}
