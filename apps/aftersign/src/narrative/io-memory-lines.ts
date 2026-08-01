export type IoPacketOutcome = "sealed" | "opened";

export type IoRouteAttention = "listened" | "skipped";

export type IoReturnTone = "kind" | "evasive" | "blunt";

export interface IoSliceMemory {
  packetOutcome: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnTone?: IoReturnTone;
}

export interface IoReturningLine {
  id: string;
  text: string;
  references: readonly string[];
}

const IO_PACKET_RETURNING_LINES: Record<IoPacketOutcome, IoReturningLine> = {
  sealed: {
    id: "io.return.packet.sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    references: ["player_returned", "packet_delivered_sealed"],
  },
  opened: {
    id: "io.return.packet.opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    references: ["player_returned", "packet_opened"],
  },
};

const IO_ROUTE_RETURNING_LINES: Record<IoRouteAttention, IoReturningLine> = {
  listened: {
    id: "io.return.route.listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: ["route_instructions_completed"],
  },
  skipped: {
    id: "io.return.route.skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    references: ["route_instructions_skipped"],
  },
};

const IO_TONE_RETURNING_LINES: Record<IoReturnTone, IoReturningLine> = {
  kind: {
    id: "io.return.tone.kind",
    text: "Kind answer. Dangerous habit here. Not useless.",
    references: ["return_answer_kind"],
  },
  evasive: {
    id: "io.return.tone.evasive",
    text: "You dodged the question. Fine. Couriers learn alleys first.",
    references: ["return_answer_evasive"],
  },
  blunt: {
    id: "io.return.tone.blunt",
    text: "Blunt answer. Saves time. Costs other things.",
    references: ["return_answer_blunt"],
  },
};

export function getIoPacketReturningLine(outcome: IoPacketOutcome): IoReturningLine {
  return IO_PACKET_RETURNING_LINES[outcome];
}

export function getIoRouteReturningLine(attention: IoRouteAttention): IoReturningLine {
  return IO_ROUTE_RETURNING_LINES[attention];
}

export function getIoToneReturningLine(tone: IoReturnTone): IoReturningLine {
  return IO_TONE_RETURNING_LINES[tone];
}

export function getIoReturningLines(memory: IoSliceMemory): readonly IoReturningLine[] {
  return [
    getIoPacketReturningLine(memory.packetOutcome),
    ...(memory.routeAttention ? [getIoRouteReturningLine(memory.routeAttention)] : []),
    ...(memory.returnTone ? [getIoToneReturningLine(memory.returnTone)] : []),
  ];
}
