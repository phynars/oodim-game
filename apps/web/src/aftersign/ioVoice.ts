export type IoPacketOutcome = "sealed" | "opened";
export type IoRouteAttention = "listened" | "skipped";
export type IoReturnTone = "kind" | "evasive" | "blunt";

export interface IoRecognitionFacts {
  packetOutcome?: IoPacketOutcome;
  routeAttention?: IoRouteAttention;
  returnTone?: IoReturnTone;
}

// Discriminated union: each variant's `referencedValue` is bound to the
// axis named by `referencedFact`. A `returnTone` line cannot carry a
// `packetOutcome` value at the type level.
export type IoRecognitionLine =
  | {
      id: string;
      text: string;
      referencedFact: "packetOutcome";
      referencedValue: IoPacketOutcome;
    }
  | {
      id: string;
      text: string;
      referencedFact: "routeAttention";
      referencedValue: IoRouteAttention;
    }
  | {
      id: string;
      text: string;
      referencedFact: "returnTone";
      referencedValue: IoReturnTone;
    };

const PACKET_LINES: {
  [K in IoPacketOutcome]: Extract<IoRecognitionLine, { referencedFact: "packetOutcome" }>;
} = {
  sealed: {
    id: "io-return-packet-sealed",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    referencedFact: "packetOutcome",
    referencedValue: "sealed",
  },
  opened: {
    id: "io-return-packet-opened",
    text: "You came back. The seal did not. I can use one of those facts.",
    referencedFact: "packetOutcome",
    referencedValue: "opened",
  },
};

const ROUTE_LINES: {
  [K in IoRouteAttention]: Extract<IoRecognitionLine, { referencedFact: "routeAttention" }>;
} = {
  listened: {
    id: "io-return-route-listened",
    text: "You listened before you ran. Rare habit. Keep it.",
    referencedFact: "routeAttention",
    referencedValue: "listened",
  },
  skipped: {
    id: "io-return-route-skipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    referencedFact: "routeAttention",
    referencedValue: "skipped",
  },
};

const TONE_LINES: {
  [K in IoReturnTone]: Extract<IoRecognitionLine, { referencedFact: "returnTone" }>;
} = {
  kind: {
    id: "io-return-tone-kind",
    text: "Kind answer. Expensive habit. Useful one.",
    referencedFact: "returnTone",
    referencedValue: "kind",
  },
  evasive: {
    id: "io-return-tone-evasive",
    text: "You dodged the why. Fine. I pay attention to where people stand after dodging.",
    referencedFact: "returnTone",
    referencedValue: "evasive",
  },
  blunt: {
    id: "io-return-tone-blunt",
    text: "Blunt answer. Saves time. Costs less if you aim it carefully.",
    referencedFact: "returnTone",
    referencedValue: "blunt",
  },
};

// Return the first matching axis (backwards-compatible with existing callers
// that only expect a single line back).
export function getIoRecognitionLine(facts: IoRecognitionFacts): IoRecognitionLine | null {
  const lines = getIoRecognitionLines(facts);
  return lines[0] ?? null;
}

// Return every axis the caller supplied a fact for, in packet → route → tone
// order. Empty array if no facts are set.
export function getIoRecognitionLines(facts: IoRecognitionFacts): readonly IoRecognitionLine[] {
  const lines: IoRecognitionLine[] = [];

  if (facts.packetOutcome) {
    lines.push(PACKET_LINES[facts.packetOutcome]);
  }

  if (facts.routeAttention) {
    lines.push(ROUTE_LINES[facts.routeAttention]);
  }

  if (facts.returnTone) {
    lines.push(TONE_LINES[facts.returnTone]);
  }

  return lines;
}

export const ioRecognitionLines = {
  packet: PACKET_LINES,
  route: ROUTE_LINES,
  tone: TONE_LINES,
} as const;
