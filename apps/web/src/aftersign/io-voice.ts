export type PacketOutcome = "sealed" | "opened";
export type ReturnTone = "kind" | "evasive" | "blunt";
export type RouteAttention = "listened" | "skipped";

export interface IoMemoryState {
  packetOutcome?: PacketOutcome;
  routeAttention?: RouteAttention;
  returnTone?: ReturnTone;
  returnedAfterClose?: boolean;
}

export interface IoLine {
  id: string;
  text: string;
  remembers: Array<keyof IoMemoryState>;
}

export const IO_FIRST_MEETING_LINES: IoLine[] = [
  {
    id: "io-first-kiosk",
    text: "Night Post takes anyone who comes back. Take the blue packet. Keep the seal honest.",
    remembers: [],
  },
  {
    id: "io-first-route",
    text: "Three lanterns up, red string left, brass box under the moth sign. If the stairs disagree, believe the string.",
    remembers: [],
  },
  {
    id: "io-first-warning",
    text: "Don't open what isn't yours unless you mean to become part of it.",
    remembers: [],
  },
];

export const IO_RETURN_LINES: Record<PacketOutcome, IoLine> = {
  sealed: {
    id: "io-return-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: ["packetOutcome", "returnedAfterClose"],
  },
  opened: {
    id: "io-return-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    remembers: ["packetOutcome", "returnedAfterClose"],
  },
};

export const IO_ROUTE_MEMORY_LINES: Record<RouteAttention, IoLine> = {
  listened: {
    id: "io-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    remembers: ["routeAttention"],
  },
  skipped: {
    id: "io-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: ["routeAttention"],
  },
};

export const IO_RETURN_TONE_LINES: Record<ReturnTone, IoLine> = {
  kind: {
    id: "io-tone-kind",
    text: "Careful answer. Dangerous thing, if you start meaning it.",
    remembers: ["returnTone"],
  },
  evasive: {
    id: "io-tone-evasive",
    text: "You dodged the question. Fine. Vey is mostly dodges with roofs nailed on.",
    remembers: ["returnTone"],
  },
  blunt: {
    id: "io-tone-blunt",
    text: "Blunt survives rain. So does brass. We'll see about you.",
    remembers: ["returnTone"],
  },
};

export function getIoRecognitionLine(memory: IoMemoryState): IoLine {
  if (memory.returnedAfterClose && memory.packetOutcome) {
    return IO_RETURN_LINES[memory.packetOutcome];
  }

  if (memory.routeAttention) {
    return IO_ROUTE_MEMORY_LINES[memory.routeAttention];
  }

  if (memory.returnTone) {
    return IO_RETURN_TONE_LINES[memory.returnTone];
  }

  return IO_FIRST_MEETING_LINES[0];
}
