export type AftersignPacketOutcome = "sealed" | "opened";

export type AftersignReturnPosture = "kind" | "evasive" | "blunt";

export interface AftersignIoMemoryContext {
  readonly packetOutcome: AftersignPacketOutcome;
  readonly returnedAfterLeaving: boolean;
  readonly listenedToRoute: boolean;
  readonly returnPosture?: AftersignReturnPosture;
}

export interface AftersignIoRecognitionLine {
  readonly id: string;
  readonly text: string;
  readonly remembers: readonly string[];
}

const PACKET_RETURN_LINES: Record<AftersignPacketOutcome, AftersignIoRecognitionLine> = {
  sealed: {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: ["returned-after-leaving", "packet-sealed"],
  },
  opened: {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    remembers: ["returned-after-leaving", "packet-opened"],
  },
};

const ROUTE_LINES: Record<"listened" | "skipped", AftersignIoRecognitionLine> = {
  listened: {
    id: "io-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    remembers: ["listened-to-route"],
  },
  skipped: {
    id: "io-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: ["skipped-route"],
  },
};

const POSTURE_LINES: Record<AftersignReturnPosture, AftersignIoRecognitionLine> = {
  kind: {
    id: "io-return-kind",
    text: "Kind answer. Not always useful. Tonight, maybe.",
    remembers: ["returned-kind"],
  },
  evasive: {
    id: "io-return-evasive",
    text: "You walked around the question. I mark detours too.",
    remembers: ["returned-evasive"],
  },
  blunt: {
    id: "io-return-blunt",
    text: "Blunt, then. Easier to file. Harder to forget.",
    remembers: ["returned-blunt"],
  },
};

export function getAftersignIoRecognitionLines(
  context: AftersignIoMemoryContext,
): readonly AftersignIoRecognitionLine[] {
  const lines: AftersignIoRecognitionLine[] = [];

  if (context.returnedAfterLeaving) {
    lines.push(PACKET_RETURN_LINES[context.packetOutcome]);
  }

  lines.push(ROUTE_LINES[context.listenedToRoute ? "listened" : "skipped"]);

  if (context.returnPosture) {
    lines.push(POSTURE_LINES[context.returnPosture]);
  }

  return lines;
}

export function getAftersignIoPrimaryReturnLine(
  context: AftersignIoMemoryContext,
): AftersignIoRecognitionLine {
  if (context.returnedAfterLeaving) {
    return PACKET_RETURN_LINES[context.packetOutcome];
  }

  return ROUTE_LINES[context.listenedToRoute ? "listened" : "skipped"];
}
