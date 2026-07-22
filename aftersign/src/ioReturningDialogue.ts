export type PacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type ReturnReason = "kind" | "evasive" | "blunt" | "unknown";

export type RouteAttention = "listened" | "skipped" | "unknown";

export interface IoMemoryRecord {
  packetOutcome?: PacketOutcome;
  returnedAfterClose?: boolean;
  routeAttention?: RouteAttention;
  returnReason?: ReturnReason;
}

export interface IoLine {
  id: string;
  text: string;
  references: readonly string[];
}

export const IO_RETURNING_LINES = {
  sealed: {
    id: "io.return.sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    references: ["returnedAfterClose", "packetOutcome:sealed"],
  },
  opened: {
    id: "io.return.opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    references: ["returnedAfterClose", "packetOutcome:opened"],
  },
  withheld: {
    id: "io.return.withheld",
    text: "You came back with the packet still in your pocket. That is not nothing. It is not delivery.",
    references: ["returnedAfterClose", "packetOutcome:withheld"],
  },
  returned: {
    id: "io.return.returned",
    text: "You brought the work back instead of losing it. Bad news, neatly labeled, still counts.",
    references: ["returnedAfterClose", "packetOutcome:returned"],
  },
  skippedRoute: {
    id: "io.return.route.skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    references: ["routeAttention:skipped"],
  },
  listenedRoute: {
    id: "io.return.route.listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: ["routeAttention:listened"],
  },
  kindReturn: {
    id: "io.return.reason.kind",
    text: "You said you came back because someone might be waiting. Dangerous answer. Useful one.",
    references: ["returnReason:kind"],
  },
  evasiveReturn: {
    id: "io.return.reason.evasive",
    text: "You dodged the question last time. Fine. Couriers live longer with one pocket closed.",
    references: ["returnReason:evasive"],
  },
  bluntReturn: {
    id: "io.return.reason.blunt",
    text: "You said you came back for the work. Clean answer. I prefer those when I can get them.",
    references: ["returnReason:blunt"],
  },
  firstReturnFallback: {
    id: "io.return.fallback",
    text: "Back after dark. Good. Vey wastes daylight. We do not.",
    references: ["returnedAfterClose"],
  },
} as const satisfies Record<string, IoLine>;

export type IoReturningLineKey = keyof typeof IO_RETURNING_LINES;

export function selectIoReturningLine(memory: IoMemoryRecord): IoLine {
  if (memory.returnedAfterClose) {
    if (memory.packetOutcome === "sealed") {
      return IO_RETURNING_LINES.sealed;
    }

    if (memory.packetOutcome === "opened") {
      return IO_RETURNING_LINES.opened;
    }

    if (memory.packetOutcome === "withheld") {
      return IO_RETURNING_LINES.withheld;
    }

    if (memory.packetOutcome === "returned") {
      return IO_RETURNING_LINES.returned;
    }
  }

  if (memory.routeAttention === "skipped") {
    return IO_RETURNING_LINES.skippedRoute;
  }

  if (memory.routeAttention === "listened") {
    return IO_RETURNING_LINES.listenedRoute;
  }

  if (memory.returnReason === "kind") {
    return IO_RETURNING_LINES.kindReturn;
  }

  if (memory.returnReason === "evasive") {
    return IO_RETURNING_LINES.evasiveReturn;
  }

  if (memory.returnReason === "blunt") {
    return IO_RETURNING_LINES.bluntReturn;
  }

  return IO_RETURNING_LINES.firstReturnFallback;
}

export function getIoReturningLineText(memory: IoMemoryRecord): string {
  return selectIoReturningLine(memory).text;
}
