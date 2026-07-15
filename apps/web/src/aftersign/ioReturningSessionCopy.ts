// Io Vale — RETURNING-session copy for the AFTERSIGN vertical slice.
//
// This module owns Io's recognition lines after the player has already made
// the sealed-packet choice. Keep these lines short, concrete, and auditable:
// every remembered sentence must point to one prior player action.

export type IoPacketMemoryOutcome = "sealed" | "opened";
export type IoRouteMemoryOutcome = "listened" | "skipped";
export type IoReturnTone = "kind" | "evasive" | "blunt";

export interface IoReturningSessionMemory {
  readonly packetOutcome?: IoPacketMemoryOutcome;
  readonly routeOutcome?: IoRouteMemoryOutcome;
  readonly returnTone?: IoReturnTone;
}

export interface IoReturningSessionLine {
  readonly id: string;
  readonly line: string;
  readonly remembers: keyof IoReturningSessionMemory;
  readonly value: string;
}

export const IO_RETURNING_PACKET_LINES: Record<IoPacketMemoryOutcome, IoReturningSessionLine> = {
  sealed: {
    id: "io.return.packet.sealed",
    line: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    remembers: "packetOutcome",
    value: "sealed",
  },
  opened: {
    id: "io.return.packet.opened",
    line: "You came back. The seal did not. I can use one of those facts.",
    remembers: "packetOutcome",
    value: "opened",
  },
};

export const IO_RETURNING_ROUTE_LINES: Record<IoRouteMemoryOutcome, IoReturningSessionLine> = {
  listened: {
    id: "io.return.route.listened",
    line: "You listened before you ran. Rare habit. Keep it.",
    remembers: "routeOutcome",
    value: "listened",
  },
  skipped: {
    id: "io.return.route.skipped",
    line: "You found the box anyway. Next time, let me finish saving your life.",
    remembers: "routeOutcome",
    value: "skipped",
  },
};

export const IO_RETURNING_TONE_LINES: Record<IoReturnTone, IoReturningSessionLine> = {
  kind: {
    id: "io.return.tone.kind",
    line: "Kind answer. Expensive habit. Useful one.",
    remembers: "returnTone",
    value: "kind",
  },
  evasive: {
    id: "io.return.tone.evasive",
    line: "You dodged the why. Fine. I pay attention to where people stand after dodging.",
    remembers: "returnTone",
    value: "evasive",
  },
  blunt: {
    id: "io.return.tone.blunt",
    line: "Blunt answer. Saves time. Costs less if you aim it carefully.",
    remembers: "returnTone",
    value: "blunt",
  },
};

export function getIoReturningSessionLines(memory: IoReturningSessionMemory): readonly IoReturningSessionLine[] {
  const lines: IoReturningSessionLine[] = [];

  if (memory.packetOutcome) {
    lines.push(IO_RETURNING_PACKET_LINES[memory.packetOutcome]);
  }

  if (memory.routeOutcome) {
    lines.push(IO_RETURNING_ROUTE_LINES[memory.routeOutcome]);
  }

  if (memory.returnTone) {
    lines.push(IO_RETURNING_TONE_LINES[memory.returnTone]);
  }

  return lines;
}
