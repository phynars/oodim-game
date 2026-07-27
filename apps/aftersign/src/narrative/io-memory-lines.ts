export type PacketOutcome = "unknown" | "sealed" | "opened" | "withheld";

export type RouteInstructionOutcome = "unknown" | "listened" | "skipped";

export type ReturnTone = "unknown" | "kind" | "evasive" | "blunt";

export type IoLineKind =
  | "briefing"
  | "packet-memory"
  | "route-memory"
  | "tone-memory";

export interface IoPlayerMemory {
  returnedAfterFirstSession: boolean;
  packetOutcome: PacketOutcome;
  routeInstructionOutcome: RouteInstructionOutcome;
  returnTone: ReturnTone;
}

export interface IoLine {
  id: string;
  kind: IoLineKind;
  text: string;
}

export const IO_FIRST_BRIEFING_LINES: readonly IoLine[] = [
  {
    id: "io-briefing-welcome",
    kind: "briefing",
    text: "Night Post needs legs, not a legend. You have legs.",
  },
  {
    id: "io-briefing-packet",
    kind: "briefing",
    text: "Blue seal stays closed. If it opens, make sure your reason is heavier than curiosity.",
  },
  {
    id: "io-briefing-route",
    kind: "briefing",
    text: "Three lanterns up, brass stair left, sign box under the moth light. Repeat that if you plan to live.",
  },
];

const IO_PACKET_MEMORY_LINES = {
  sealed: {
    id: "io-return-packet-sealed",
    kind: "packet-memory",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  opened: {
    id: "io-return-packet-opened",
    kind: "packet-memory",
    text: "You came back. The seal did not. I can use one of those facts.",
  },
  withheld: {
    id: "io-return-packet-withheld",
    kind: "packet-memory",
    text: "You kept the packet. Bold way to ask whether I count losses by weight.",
  },
} as const satisfies Partial<Record<PacketOutcome, IoLine>>;

const IO_ROUTE_MEMORY_LINES = {
  listened: {
    id: "io-return-route-listened",
    kind: "route-memory",
    text: "You listened before you ran. Rare habit. Keep it.",
  },
  skipped: {
    id: "io-return-route-skipped",
    kind: "route-memory",
    text: "You found the box anyway. Next time, let me finish saving your life.",
  },
} as const satisfies Partial<Record<RouteInstructionOutcome, IoLine>>;

const IO_TONE_MEMORY_LINES = {
  kind: {
    id: "io-return-tone-kind",
    kind: "tone-memory",
    text: "You came back kindly. Dangerous habit. Useful one.",
  },
  evasive: {
    id: "io-return-tone-evasive",
    kind: "tone-memory",
    text: "You dodged the question last time. I marked the dodge, not the answer.",
  },
  blunt: {
    id: "io-return-tone-blunt",
    kind: "tone-memory",
    text: "Blunt truth, then a return trip. I prefer tools that show their edge.",
  },
} as const satisfies Partial<Record<ReturnTone, IoLine>>;

export function selectIoReturningLines(memory: IoPlayerMemory): IoLine[] {
  if (!memory.returnedAfterFirstSession) {
    return [];
  }

  return [
    IO_PACKET_MEMORY_LINES[memory.packetOutcome],
    IO_ROUTE_MEMORY_LINES[memory.routeInstructionOutcome],
    IO_TONE_MEMORY_LINES[memory.returnTone],
  ].filter((line): line is IoLine => line !== undefined);
}
