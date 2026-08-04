export type IoPacketOutcome = "sealed" | "opened" | "unknown";
export type IoRouteOutcome = "listened" | "skipped" | "unknown";

export type IoMemoryInput = {
  packetOutcome?: IoPacketOutcome | null;
  heardRoute?: boolean | null;
};

export type IoMemoryReference = {
  key: "packetOutcome" | "heardRoute";
  value: IoPacketOutcome | IoRouteOutcome;
};

export type IoMemoryLine = {
  id: string;
  text: string;
  references: IoMemoryReference[];
};

const PACKET_LINES = {
  sealed: {
    id: "io.return.packet.sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    references: [{ key: "packetOutcome", value: "sealed" }],
  },
  opened: {
    id: "io.return.packet.opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    references: [{ key: "packetOutcome", value: "opened" }],
  },
  unknown: {
    id: "io.return.packet.unknown",
    text: "You came back. I have the gap in my ledger. We will work around it.",
    references: [{ key: "packetOutcome", value: "unknown" }],
  },
} as const satisfies Record<IoPacketOutcome, IoMemoryLine>;

const ROUTE_LINES = {
  listened: {
    id: "io.route.listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: [{ key: "heardRoute", value: "listened" }],
  },
  skipped: {
    id: "io.route.skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    references: [{ key: "heardRoute", value: "skipped" }],
  },
  unknown: {
    id: "io.route.unknown",
    text: "You reached the box. How much of that was luck is still open.",
    references: [{ key: "heardRoute", value: "unknown" }],
  },
} as const satisfies Record<IoRouteOutcome, IoMemoryLine>;

export function getIoMemoryLine(memory: IoMemoryInput = {}): IoMemoryLine {
  const packetOutcome = normalizePacketOutcome(memory.packetOutcome);
  return PACKET_LINES[packetOutcome];
}

export function getIoRouteLine(memory: IoMemoryInput = {}): IoMemoryLine {
  const routeOutcome = normalizeRouteOutcome(memory.heardRoute);
  return ROUTE_LINES[routeOutcome];
}

export function listIoMemoryLines(): IoMemoryLine[] {
  return [...Object.values(PACKET_LINES), ...Object.values(ROUTE_LINES)];
}

function normalizePacketOutcome(packetOutcome: IoMemoryInput["packetOutcome"]): IoPacketOutcome {
  if (packetOutcome === "sealed" || packetOutcome === "opened") {
    return packetOutcome;
  }

  return "unknown";
}

function normalizeRouteOutcome(heardRoute: IoMemoryInput["heardRoute"]): IoRouteOutcome {
  if (heardRoute === true) {
    return "listened";
  }

  if (heardRoute === false) {
    return "skipped";
  }

  return "unknown";
}
