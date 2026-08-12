// Single source of truth for `AftersignPacketOutcome` lives in
// `verticalSliceState.ts` — re-export it here so the voice contract cannot
// drift from the state contract. See PR #758 review.
export type { AftersignPacketOutcome } from "./verticalSliceState";
import type { AftersignPacketOutcome } from "./verticalSliceState";

export const AFTERSIGN_PACKET_OUTCOMES = ["sealed", "opened"] as const satisfies readonly AftersignPacketOutcome[];

export type AftersignRouteAttention = "heard" | "skipped";
export type AftersignReturnReason = "kind" | "evasive" | "blunt";

export type AftersignIoLineKey =
  | "firstGreeting"
  | "packetOffer"
  | "routeHeard"
  | "routeSkipped"
  | "sealedReturn"
  | "openedReturn"
  | "kindReturn"
  | "evasiveReturn"
  | "bluntReturn";

export type AftersignIoLine = {
  key: AftersignIoLineKey;
  text: string;
  memorySentence?: string;
};

export const AFTERSIGN_IO_LINES: Record<AftersignIoLineKey, AftersignIoLine> = {
  firstGreeting: {
    key: "firstGreeting",
    text: "You are late for a job you do not remember taking. That is common here. Less common: coming anyway.",
  },
  packetOffer: {
    key: "packetOffer",
    text: "Blue seal. Brass box. Do not improve the message on the way.",
  },
  routeHeard: {
    key: "routeHeard",
    text: "You listened before you ran. Rare habit. Keep it.",
    memorySentence: "Io remembers that the courier listened to the route before leaving.",
  },
  routeSkipped: {
    key: "routeSkipped",
    text: "You found the box anyway. Next time, let me finish saving your life.",
    memorySentence: "Io remembers that the courier skipped the route instructions.",
  },
  sealedReturn: {
    key: "sealedReturn",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    memorySentence: "Io remembers that the courier delivered the blue packet sealed.",
  },
  openedReturn: {
    key: "openedReturn",
    text: "You came back. The seal did not. I can use one of those facts.",
    memorySentence: "Io remembers that the courier opened the blue packet.",
  },
  kindReturn: {
    key: "kindReturn",
    text: "Kind answer. Expensive, if you mean it. Cheap, if you do not.",
    memorySentence: "Io remembers that the courier gave a kind answer when asked why they returned.",
  },
  evasiveReturn: {
    key: "evasiveReturn",
    text: "You dodged the question. Fine. Vey has alleys for that. They still lead somewhere.",
    memorySentence: "Io remembers that the courier avoided saying why they returned.",
  },
  bluntReturn: {
    key: "bluntReturn",
    text: "Blunt, then. Good. Wrapped truths get waterlogged here.",
    memorySentence: "Io remembers that the courier answered bluntly when asked why they returned.",
  },
};

export type AftersignIoReturnMemoryThreadInput = {
  routeAttention: AftersignRouteAttention;
  packetOutcome: string | null | undefined;
  returnReason: AftersignReturnReason;
};

// Compile-time exhaustiveness helper. If a discriminated union grows
// a new member and any of the selectors below stop covering it, the
// `never` argument type check fails the build — restoring the guard
// PR #758 / #789 fought for after the switch-to-ternary drift.
function assertNever(x: never, hint: string): never {
  throw new Error(`Aftersign Io voice contract missed case: ${hint} (${String(x)})`);
}

export function normalizeAftersignPacketOutcome(
  outcome: string | null | undefined,
): AftersignPacketOutcome {
  return outcome === "opened" ? "opened" : "sealed";
}

export function ioPacketReturnLine(outcome: string | null | undefined): AftersignIoLine {
  // Normalize FIRST, then switch exhaustively over the concrete union
  // so a future `AftersignPacketOutcome` member fails the build here
  // (instead of silently falling to `sealed` through a ternary).
  const normalized: AftersignPacketOutcome = normalizeAftersignPacketOutcome(outcome);
  switch (normalized) {
    case "opened":
      return AFTERSIGN_IO_LINES.openedReturn;
    case "sealed":
      return AFTERSIGN_IO_LINES.sealedReturn;
    default:
      return assertNever(normalized, "ioPacketReturnLine");
  }
}

export function ioRouteAttentionLine(attention: AftersignRouteAttention): AftersignIoLine {
  switch (attention) {
    case "heard":
      return AFTERSIGN_IO_LINES.routeHeard;
    case "skipped":
      return AFTERSIGN_IO_LINES.routeSkipped;
    default:
      return assertNever(attention, "ioRouteAttentionLine");
  }
}

export function ioReturnReasonLine(reason: AftersignReturnReason): AftersignIoLine {
  switch (reason) {
    case "kind":
      return AFTERSIGN_IO_LINES.kindReturn;
    case "evasive":
      return AFTERSIGN_IO_LINES.evasiveReturn;
    case "blunt":
      return AFTERSIGN_IO_LINES.bluntReturn;
    default:
      return assertNever(reason, "ioReturnReasonLine");
  }
}

export function buildIoMemorySentence(line: AftersignIoLine): string {
  return line.memorySentence ?? `Io remembers: ${line.text}`;
}

export function buildIoReturnMemoryThread({
  routeAttention,
  packetOutcome,
  returnReason,
}: AftersignIoReturnMemoryThreadInput): readonly string[] {
  return [
    buildIoMemorySentence(ioRouteAttentionLine(routeAttention)),
    buildIoMemorySentence(ioPacketReturnLine(packetOutcome)),
    buildIoMemorySentence(ioReturnReasonLine(returnReason)),
  ];
}
