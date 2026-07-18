// Aftersign Io voice contract (web view).
//
// Line strings are owned by
// `packages/aftersign/src/ioReturningSession.ts`. The harness asserts
// those verbatim, and `ioReturningSessionLines.ts` documents the
// package as the single source. Redeclaring the strings here would
// silently drift — instead we pull each canonical line by key and
// decorate it with the UI-side metadata (stable id + `remembers`
// tags) that recognition surfaces need.
//
// If a line ever needs to change, edit the package.

import {
  getIoReturningSessionLine,
  type IoPacketOutcome,
  type IoReturnAnswerTone,
} from '../../../../packages/aftersign/src/ioReturningSession'

export type AftersignPacketOutcome = IoPacketOutcome;

export type AftersignReturnPosture = IoReturnAnswerTone;

export interface AftersignIoMemoryContext {
  readonly packetOutcome: AftersignPacketOutcome;
  readonly returnedAfterLeaving: boolean;
  readonly listenedToRoute: boolean;
  readonly returnPosture?: AftersignReturnPosture;
}

export interface AftersignIoRecognitionLine {
  readonly id: string;
  readonly text: string;
  readonly remembers: readonly string[];
}

const PACKET_RETURN_LINES: Record<AftersignPacketOutcome, AftersignIoRecognitionLine> = {
  sealed: {
    id: "io-return-packet-sealed",
    text: getIoReturningSessionLine("sealedPacket"),
    remembers: ["returned-after-leaving", "packet-sealed"],
  },
  opened: {
    id: "io-return-packet-opened",
    text: getIoReturningSessionLine("openedPacket"),
    remembers: ["returned-after-leaving", "packet-opened"],
  },
};

const ROUTE_LINES: Record<"listened" | "skipped", AftersignIoRecognitionLine> = {
  listened: {
    id: "io-route-listened",
    text: getIoReturningSessionLine("listenedRoute"),
    remembers: ["listened-to-route"],
  },
  skipped: {
    id: "io-route-skipped",
    text: getIoReturningSessionLine("skippedRoute"),
    remembers: ["skipped-route"],
  },
};

const POSTURE_LINES: Record<AftersignReturnPosture, AftersignIoRecognitionLine> = {
  kind: {
    id: "io-return-kind",
    text: getIoReturningSessionLine("kindReturn"),
    remembers: ["returned-kind"],
  },
  evasive: {
    id: "io-return-evasive",
    text: getIoReturningSessionLine("evasiveReturn"),
    remembers: ["returned-evasive"],
  },
  blunt: {
    id: "io-return-blunt",
    text: getIoReturningSessionLine("bluntReturn"),
    remembers: ["returned-blunt"],
  },
};

export function getAftersignIoRecognitionLines(
  context: AftersignIoMemoryContext,
): readonly AftersignIoRecognitionLine[] {
  const lines: AftersignIoRecognitionLine[] = [];

  if (context.returnedAfterLeaving) {
    lines.push(PACKET_RETURN_LINES[context.packetOutcome]);
  }

  lines.push(ROUTE_LINES[context.listenedToRoute ? "listened" : "skipped"]);

  if (context.returnPosture) {
    lines.push(POSTURE_LINES[context.returnPosture]);
  }

  return lines;
}

export function getAftersignIoPrimaryReturnLine(
  context: AftersignIoMemoryContext,
): AftersignIoRecognitionLine {
  if (context.returnedAfterLeaving) {
    return PACKET_RETURN_LINES[context.packetOutcome];
  }

  return ROUTE_LINES[context.listenedToRoute ? "listened" : "skipped"];
}
