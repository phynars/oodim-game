export type AftersignPacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type AftersignRouteAttention = "listened" | "skipped" | "unknown";

export type AftersignReturnReason = "kind" | "evasive" | "blunt" | "unknown";

export type AftersignIoMemoryRecord = {
  packetOutcome?: AftersignPacketOutcome;
  returnedAfterClose?: boolean;
  routeAttention?: AftersignRouteAttention;
  returnReason?: AftersignReturnReason;
};

export type AftersignIoMemoryReference =
  | "packet:sealed"
  | "packet:opened"
  | "packet:withheld"
  | "packet:returned"
  | "return:after-close"
  | "route:listened"
  | "route:skipped"
  | "reason:kind"
  | "reason:evasive"
  | "reason:blunt";

export type AftersignIoReturningLineId =
  | "io-returned-seal-unbroken"
  | "io-returned-seal-broken"
  | "io-returned-packet-withheld"
  | "io-returned-packet-returned"
  | "io-returned-route-skipped"
  | "io-returned-route-listened"
  | "io-returned-reason-kind"
  | "io-returned-reason-evasive"
  | "io-returned-reason-blunt"
  | "io-returned-fallback";

export type AftersignIoReturningLine = {
  id: AftersignIoReturningLineId;
  text: string;
  references: AftersignIoMemoryReference[];
};

const IO_RETURNING_LINES = {
  sealed: {
    id: "io-returned-seal-unbroken",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    references: ["return:after-close", "packet:sealed"],
  },
  opened: {
    id: "io-returned-seal-broken",
    text: "You came back. The seal did not. I can use one of those facts.",
    references: ["return:after-close", "packet:opened"],
  },
  withheld: {
    id: "io-returned-packet-withheld",
    text: "You kept the packet. Not theft, not delivery. A third column in a bad ledger.",
    references: ["packet:withheld"],
  },
  returned: {
    id: "io-returned-packet-returned",
    text: "You brought it back instead of guessing. That saves more lives than speed does.",
    references: ["packet:returned"],
  },
  skippedRoute: {
    id: "io-returned-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    references: ["route:skipped"],
  },
  listenedRoute: {
    id: "io-returned-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: ["route:listened"],
  },
  kindReason: {
    id: "io-returned-reason-kind",
    text: "You came back kind. Useful, if you keep it sharper than pity.",
    references: ["reason:kind"],
  },
  evasiveReason: {
    id: "io-returned-reason-evasive",
    text: "You came back with half an answer. I can work with half. I charge extra for it.",
    references: ["reason:evasive"],
  },
  bluntReason: {
    id: "io-returned-reason-blunt",
    text: "You came back blunt. Good. The city lies enough for both of us.",
    references: ["reason:blunt"],
  },
  fallback: {
    id: "io-returned-fallback",
    text: "Back again. Good. Vey wastes plenty. I try not to waste returns.",
    references: [],
  },
} as const satisfies Record<string, AftersignIoReturningLine>;

export function chooseAftersignIoReturningLine(
  memory: AftersignIoMemoryRecord,
): AftersignIoReturningLine {
  if (memory.returnedAfterClose && memory.packetOutcome === "sealed") {
    return IO_RETURNING_LINES.sealed;
  }

  if (memory.returnedAfterClose && memory.packetOutcome === "opened") {
    return IO_RETURNING_LINES.opened;
  }

  if (memory.packetOutcome === "withheld") {
    return IO_RETURNING_LINES.withheld;
  }

  if (memory.packetOutcome === "returned") {
    return IO_RETURNING_LINES.returned;
  }

  if (memory.routeAttention === "skipped") {
    return IO_RETURNING_LINES.skippedRoute;
  }

  if (memory.routeAttention === "listened") {
    return IO_RETURNING_LINES.listenedRoute;
  }

  if (memory.returnReason === "kind") {
    return IO_RETURNING_LINES.kindReason;
  }

  if (memory.returnReason === "evasive") {
    return IO_RETURNING_LINES.evasiveReason;
  }

  if (memory.returnReason === "blunt") {
    return IO_RETURNING_LINES.bluntReason;
  }

  return IO_RETURNING_LINES.fallback;
}

export function listAftersignIoReturningLines(): AftersignIoReturningLine[] {
  return Object.values(IO_RETURNING_LINES);
}
