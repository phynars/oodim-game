export type AftersignPacketOutcome = "sealed" | "opened";
export type AftersignRouteMemory = "listened" | "skipped";
export type AftersignReturnPosture = "kind" | "evasive" | "blunt";

export type AftersignIoReturnMemory = {
  packetOutcome?: AftersignPacketOutcome;
  routeMemory?: AftersignRouteMemory;
  returnPosture?: AftersignReturnPosture;
};

export type AftersignIoReturnLine = {
  id: string;
  text: string;
  remembers: keyof AftersignIoReturnMemory;
};

const PACKET_RETURN_LINES: Record<AftersignPacketOutcome, AftersignIoReturnLine> = {
  sealed: {
    id: "io.return.packet.sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: "packetOutcome",
  },
  opened: {
    id: "io.return.packet.opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    remembers: "packetOutcome",
  },
};

const ROUTE_RETURN_LINES: Record<AftersignRouteMemory, AftersignIoReturnLine> = {
  listened: {
    id: "io.return.route.listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    remembers: "routeMemory",
  },
  skipped: {
    id: "io.return.route.skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: "routeMemory",
  },
};

const POSTURE_RETURN_LINES: Record<AftersignReturnPosture, AftersignIoReturnLine> = {
  kind: {
    id: "io.return.posture.kind",
    text: "You softened the answer. I noticed. So will the city.",
    remembers: "returnPosture",
  },
  evasive: {
    id: "io.return.posture.evasive",
    text: "You walked around the question. Efficient. Not invisible.",
    remembers: "returnPosture",
  },
  blunt: {
    id: "io.return.posture.blunt",
    text: "You answered like a door closing. Useful, if the hinge holds.",
    remembers: "returnPosture",
  },
};

export function getIoReturnLine(memory: AftersignIoReturnMemory): AftersignIoReturnLine {
  if (memory.packetOutcome) {
    return PACKET_RETURN_LINES[memory.packetOutcome];
  }

  if (memory.routeMemory) {
    return ROUTE_RETURN_LINES[memory.routeMemory];
  }

  if (memory.returnPosture) {
    return POSTURE_RETURN_LINES[memory.returnPosture];
  }

  return {
    id: "io.return.fallback",
    text: "Back again. Good. Vey likes proof more than promises.",
    remembers: "packetOutcome",
  };
}

export const AFTERSIGN_IO_RETURN_LINES = {
  packet: PACKET_RETURN_LINES,
  route: ROUTE_RETURN_LINES,
  posture: POSTURE_RETURN_LINES,
} as const;
