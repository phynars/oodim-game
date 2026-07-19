export type IoPacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type IoRouteBehavior = "listened" | "skipped";

export type IoReturnPosture = "kind" | "evasive" | "blunt";

export interface IoMemoryRecord {
  packetOutcome?: IoPacketOutcome;
  routeBehavior?: IoRouteBehavior;
  returnPosture?: IoReturnPosture;
}

export interface IoLine {
  id: string;
  text: string;
  remembers: keyof IoMemoryRecord;
  value: IoPacketOutcome | IoRouteBehavior | IoReturnPosture;
}

export const IO_PACKET_MEMORY_LINES: Record<Extract<IoPacketOutcome, "sealed" | "opened">, IoLine> = {
  sealed: {
    id: "io.return.packet.sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: "packetOutcome",
    value: "sealed",
  },
  opened: {
    id: "io.return.packet.opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    remembers: "packetOutcome",
    value: "opened",
  },
};

export const IO_ROUTE_MEMORY_LINES: Record<IoRouteBehavior, IoLine> = {
  skipped: {
    id: "io.return.route.skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: "routeBehavior",
    value: "skipped",
  },
  listened: {
    id: "io.return.route.listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    remembers: "routeBehavior",
    value: "listened",
  },
};

export const IO_POSTURE_MEMORY_LINES: Record<IoReturnPosture, IoLine> = {
  kind: {
    id: "io.return.posture.kind",
    text: "You came back soft-handed. Vey eats that sometimes. Not always.",
    remembers: "returnPosture",
    value: "kind",
  },
  evasive: {
    id: "io.return.posture.evasive",
    text: "You dodged the question. Fine. Dodging is still a route.",
    remembers: "returnPosture",
    value: "evasive",
  },
  blunt: {
    id: "io.return.posture.blunt",
    text: "Blunt answer. Saves time. Costs less than a lie.",
    remembers: "returnPosture",
    value: "blunt",
  },
};

export function getIoReturnLine(memory: IoMemoryRecord): IoLine {
  if (memory.packetOutcome === "sealed" || memory.packetOutcome === "opened") {
    return IO_PACKET_MEMORY_LINES[memory.packetOutcome];
  }

  if (memory.routeBehavior) {
    return IO_ROUTE_MEMORY_LINES[memory.routeBehavior];
  }

  if (memory.returnPosture) {
    return IO_POSTURE_MEMORY_LINES[memory.returnPosture];
  }

  return {
    id: "io.return.default",
    text: "You came back. Good. The city keeps receipts.",
    remembers: "packetOutcome",
    value: "returned",
  };
}
