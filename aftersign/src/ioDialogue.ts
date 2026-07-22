export type PacketOutcome = "sealed" | "opened" | "withheld" | "returned";

export type RouteAttention = "listened" | "skipped";

export type ReturnReasonTone = "kind" | "evasive" | "blunt";

export interface IoPlayerMemory {
  readonly packetOutcome?: PacketOutcome;
  readonly routeAttention?: RouteAttention;
  readonly returnedAfterClose?: boolean;
  readonly returnReasonTone?: ReturnReasonTone;
}

export interface IoDialogueLine {
  readonly id: string;
  readonly text: string;
  readonly remembers: readonly (keyof IoPlayerMemory)[];
}

export const IO_FIRST_MEETING_LINES = {
  arrival: {
    id: "io.first.arrival",
    text: "You made it after dark. Either you are lost or useful. Stand still while I decide.",
    remembers: [],
  },
  packetOffer: {
    id: "io.first.packet-offer",
    text: "Blue seal. Silt Stair box. Do not open what is not addressed to you.",
    remembers: [],
  },
  routePrompt: {
    id: "io.first.route-prompt",
    text: "Three lanterns down, brass stairs up, moth sign left. If the water speaks, ignore it.",
    remembers: [],
  },
} as const satisfies Record<string, IoDialogueLine>;

export const IO_RETURNING_LINES = {
  sealedPacket: {
    id: "io.return.packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: ["returnedAfterClose", "packetOutcome"],
  },
  openedPacket: {
    id: "io.return.packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    remembers: ["returnedAfterClose", "packetOutcome"],
  },
  withheldPacket: {
    id: "io.return.packet-withheld",
    text: "You came back with the packet still in your pocket. That is not nothing. It is not delivery.",
    remembers: ["returnedAfterClose", "packetOutcome"],
  },
  returnedPacket: {
    id: "io.return.packet-returned",
    text: "You brought the work back instead of losing it. Bad news, neatly labeled, still counts.",
    remembers: ["returnedAfterClose", "packetOutcome"],
  },
  skippedRoute: {
    id: "io.return.route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: ["routeAttention"],
  },
  listenedRoute: {
    id: "io.return.route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    remembers: ["routeAttention"],
  },
  kindReturn: {
    id: "io.return.reason-kind",
    text: "You came back kindly. Vey eats that first. Keep some hidden.",
    remembers: ["returnReasonTone"],
  },
  evasiveReturn: {
    id: "io.return.reason-evasive",
    text: "You dodged the question. Fine. Couriers are allowed one locked room.",
    remembers: ["returnReasonTone"],
  },
  bluntReturn: {
    id: "io.return.reason-blunt",
    text: "Blunt answer. Good. The city has enough fog without you adding more.",
    remembers: ["returnReasonTone"],
  },
} as const satisfies Record<string, IoDialogueLine>;

export function getIoPacketReturnLine(memory: IoPlayerMemory): IoDialogueLine {
  switch (memory.packetOutcome) {
    case "opened":
      return IO_RETURNING_LINES.openedPacket;
    case "withheld":
      return IO_RETURNING_LINES.withheldPacket;
    case "returned":
      return IO_RETURNING_LINES.returnedPacket;
    case "sealed":
    default:
      return IO_RETURNING_LINES.sealedPacket;
  }
}

export function getIoRouteReturnLine(memory: IoPlayerMemory): IoDialogueLine | null {
  if (memory.routeAttention === "skipped") {
    return IO_RETURNING_LINES.skippedRoute;
  }

  if (memory.routeAttention === "listened") {
    return IO_RETURNING_LINES.listenedRoute;
  }

  return null;
}

export function getIoReturnReasonLine(memory: IoPlayerMemory): IoDialogueLine | null {
  if (memory.returnReasonTone === "kind") {
    return IO_RETURNING_LINES.kindReturn;
  }

  if (memory.returnReasonTone === "evasive") {
    return IO_RETURNING_LINES.evasiveReturn;
  }

  if (memory.returnReasonTone === "blunt") {
    return IO_RETURNING_LINES.bluntReturn;
  }

  return null;
}

export function getIoReturningDialogue(memory: IoPlayerMemory): readonly IoDialogueLine[] {
  return [
    getIoPacketReturnLine(memory),
    getIoRouteReturnLine(memory),
    getIoReturnReasonLine(memory),
  ].filter((line): line is IoDialogueLine => line !== null);
}
