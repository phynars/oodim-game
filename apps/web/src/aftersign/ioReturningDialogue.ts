// Io's returning-scene dialogue selector.
//
// This module owns SELECTION LOGIC only — every line of COPY it exposes
// is delegated to `ioVoiceContract.ts`. Forking the copy here has been
// rejected twice in review (see PR #758, PR #789, PR #1131): a second
// source of truth drifts on the next scene change and Io ends up
// remembering different words than the rest of the game records.
//
// Single sources of truth this module reads:
//   • AftersignPacketOutcome    ← verticalSliceState.ts
//   • AftersignRouteAttention   ← ioVoiceContract.ts
//   • Line COPY (sealed/opened/heard/skipped) ← ioVoiceContract.ts

import type { AftersignPacketOutcome } from "./verticalSliceState";
import {
  AFTERSIGN_IO_LINES,
  ioPacketReturnLine,
  ioRouteAttentionLine,
  type AftersignRouteAttention,
} from "./ioVoiceContract";

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

// Line COPY is imported from the contract; only the harness-level
// `id` + `references` metadata is local. If a copy edit lands in
// `AFTERSIGN_IO_LINES`, this module inherits it automatically — no
// two-file rename ever again.
export const AFTERSIGN_IO_RETURNING_LINES = {
  packetSealed: {
    id: "io-return-packet-sealed",
    text: AFTERSIGN_IO_LINES.sealedReturn.text,
    references: ["packetOutcome:sealed", "returnedAfterClose:true"],
  },
  packetOpened: {
    id: "io-return-packet-opened",
    text: AFTERSIGN_IO_LINES.openedReturn.text,
    references: ["packetOutcome:opened", "returnedAfterClose:true"],
  },
  routeSkipped: {
    id: "io-return-route-skipped",
    text: AFTERSIGN_IO_LINES.routeSkipped.text,
    references: ["routeAttention:skipped"],
  },
  routeHeard: {
    id: "io-return-route-heard",
    text: AFTERSIGN_IO_LINES.routeHeard.text,
    references: ["routeAttention:heard"],
  },
  // Fallback stays local — the contract intentionally has no
  // "nothing-to-remember" line because a fresh runtime state never
  // reaches Io's return beat. This harness lets tests exercise the
  // empty-memory arm without teaching the contract about it.
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
 * conscious choice, never by an unhandled case slipping through. Copy
 * selection now delegates to `ioVoiceContract.ts` so this module cannot
 * drift from the surface's `windowGameSurface.ts` memory thread; both
 * read the same authored lines from `AFTERSIGN_IO_LINES`.
 */
export function chooseAftersignIoReturningLine(
  memory: AftersignIoMemory,
): AftersignIoReturningLine {
  if (memory.packetOutcome !== undefined) {
    // Contract selector picks the AftersignIoLine; we wrap it into the
    // harness's `{ id, text, references }` shape by looking up the
    // matching AFTERSIGN_IO_RETURNING_LINES entry. This keeps the
    // harness's `references` audit trail intact while eliminating the
    // copy-drift risk on `text`.
    const contractLine = ioPacketReturnLine(memory.packetOutcome);
    return contractLine === AFTERSIGN_IO_LINES.openedReturn
      ? AFTERSIGN_IO_RETURNING_LINES.packetOpened
      : AFTERSIGN_IO_RETURNING_LINES.packetSealed;
  }

  if (memory.routeAttention !== undefined) {
    const contractLine = ioRouteAttentionLine(memory.routeAttention);
    return contractLine === AFTERSIGN_IO_LINES.routeHeard
      ? AFTERSIGN_IO_RETURNING_LINES.routeHeard
      : AFTERSIGN_IO_RETURNING_LINES.routeSkipped;
  }

  return AFTERSIGN_IO_RETURNING_LINES.fallback;
}
