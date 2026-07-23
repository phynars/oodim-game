export type AftersignPacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type AftersignRouteAttention = "listened" | "skipped" | "unknown";

export type AftersignIoMemory = {
  packetOutcome?: AftersignPacketOutcome;
  routeAttention?: AftersignRouteAttention;
  returnedAfterClose?: boolean;
};

export type AftersignIoReturningLine = {
  id: string;
  text: string;
  references: string[];
};

export const AFTERSIGN_IO_RETURNING_LINES = {
  packetSealed: {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    references: ["packetOutcome:sealed", "returnedAfterClose:true"],
  },
  packetOpened: {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    references: ["packetOutcome:opened", "returnedAfterClose:true"],
  },
  routeSkipped: {
    id: "io-return-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    references: ["routeAttention:skipped"],
  },
  routeListened: {
    id: "io-return-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: ["routeAttention:listened"],
  },
  fallback: {
    id: "io-return-fallback",
    text: "Back again. Good. Vey keeps receipts better than people do.",
    references: [],
  },
} as const satisfies Record<string, AftersignIoReturningLine>;

export function chooseAftersignIoReturningLine(
  memory: AftersignIoMemory,
): AftersignIoReturningLine {
  if (memory.packetOutcome === "sealed") {
    return AFTERSIGN_IO_RETURNING_LINES.packetSealed;
  }

  if (memory.packetOutcome === "opened") {
    return AFTERSIGN_IO_RETURNING_LINES.packetOpened;
  }

  if (memory.routeAttention === "skipped") {
    return AFTERSIGN_IO_RETURNING_LINES.routeSkipped;
  }

  if (memory.routeAttention === "listened") {
    return AFTERSIGN_IO_RETURNING_LINES.routeListened;
  }

  return AFTERSIGN_IO_RETURNING_LINES.fallback;
}
