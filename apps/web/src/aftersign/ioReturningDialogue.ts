// Io's returning-scene dialogue selector.
//
// This module owns line COPY only. The shape of the memory it reads —
// `AftersignPacketOutcome`, `AftersignRouteAttention` — belongs to the
// canonical contracts and is re-imported here. Forking either union in
// this file has been rejected in review (see PR #758, PR #789):
// the type would drift from `verticalSliceState.ts` / `ioVoiceContract.ts`
// on the next save-format or scene change, and Io would start remembering
// facts the rest of the game never records.
//
// Single sources of truth:
//   • AftersignPacketOutcome    ← verticalSliceState.ts
//   • AftersignRouteAttention   ← ioVoiceContract.ts

import type { AftersignPacketOutcome } from "./verticalSliceState";
import type { AftersignRouteAttention } from "./ioVoiceContract";

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
  routeHeard: {
    id: "io-return-route-heard",
    text: "You listened before you ran. Rare habit. Keep it.",
    references: ["routeAttention:heard"],
  },
  fallback: {
    id: "io-return-fallback",
    text: "Back again. Good. Vey keeps receipts better than people do.",
    references: [],
  },
} as const satisfies Record<string, AftersignIoReturningLine>;

/**
 * Choose Io's returning line from the auditable memory the harness passes in.
 *
 * Contract: every arm of every union in `AftersignIoMemory` must reach a
 * concrete line — either a specific memory line, or the fallback by
 * conscious choice, never by an unhandled case slipping through. If a new
 * value is ever added to `AftersignPacketOutcome` or `AftersignRouteAttention`
 * upstream, TypeScript's exhaustive-switch check below will fail the build
 * until this function is updated to say what Io remembers about it.
 */
export function chooseAftersignIoReturningLine(
  memory: AftersignIoMemory,
): AftersignIoReturningLine {
  const packetLine = linePacketOutcome(memory.packetOutcome);
  if (packetLine) {
    return packetLine;
  }

  const routeLine = lineRouteAttention(memory.routeAttention);
  if (routeLine) {
    return routeLine;
  }

  return AFTERSIGN_IO_RETURNING_LINES.fallback;
}

function linePacketOutcome(
  outcome: AftersignPacketOutcome | undefined,
): AftersignIoReturningLine | null {
  if (outcome === undefined) {
    return null;
  }
  switch (outcome) {
    case "sealed":
      return AFTERSIGN_IO_RETURNING_LINES.packetSealed;
    case "opened":
      return AFTERSIGN_IO_RETURNING_LINES.packetOpened;
    default:
      return assertNever(outcome);
  }
}

function lineRouteAttention(
  attention: AftersignRouteAttention | undefined,
): AftersignIoReturningLine | null {
  if (attention === undefined) {
    return null;
  }
  switch (attention) {
    case "heard":
      return AFTERSIGN_IO_RETURNING_LINES.routeHeard;
    case "skipped":
      return AFTERSIGN_IO_RETURNING_LINES.routeSkipped;
    default:
      return assertNever(attention);
  }
}

function assertNever(value: never): never {
  throw new Error(
    `chooseAftersignIoReturningLine: unhandled union member ${JSON.stringify(value)}`,
  );
}
