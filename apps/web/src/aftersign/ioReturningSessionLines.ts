// Web view of Io's returning-session copy.
//
// SINGLE-SOURCE CONTRACT: the line STRINGS live in the authority package
// (`packages/aftersign/src/ioReturningSession.ts`, re-exported here via
// `./ioReturningSession`). This module ONLY reshapes them for the harness
// — mapping the authority's line-key vocabulary onto the harness's
// outcome vocabulary and attaching `rememberedAction` metadata that
// describes the physical player choice each line responds to.
//
// Do NOT inline any of the authored line strings here. If you find
// yourself typing a Io line, stop: add it to the authority instead.
// `ioReturningSessionLines.test.ts` asserts every `line` field in this
// module matches the authority verbatim; forking will fail CI.

import {
  ioReturningSessionLines as authoredLines,
  type IoReturningSessionLineKey,
} from "./ioReturningSession";

export type AftersignIoReturningSessionOutcome =
  | "sealed"
  | "opened"
  | "skippedRoute"
  | "listenedRoute";

export type AftersignIoReturningSessionLine = {
  outcome: AftersignIoReturningSessionOutcome;
  rememberedAction: string;
  line: string;
};

// Outcome vocabulary (harness-facing) → line-key vocabulary (authority).
// Kept as a small, explicit table so a rename on either side trips the
// test in `ioReturningSessionLines.test.ts` instead of drifting silently.
const outcomeToLineKey: Record<AftersignIoReturningSessionOutcome, IoReturningSessionLineKey> = {
  sealed: "sealedPacket",
  opened: "openedPacket",
  skippedRoute: "skippedRoute",
  listenedRoute: "listenedRoute",
};

// The physical player action each outcome remembers. This metadata is
// authored HERE (not in the authority) because it describes the harness's
// interpretation of what the player did, not the NPC's dialogue.
const rememberedActionByOutcome: Record<AftersignIoReturningSessionOutcome, string> = {
  sealed: "delivered the blue packet with its seal unbroken",
  opened: "opened the blue packet before returning",
  skippedRoute: "left before Io finished the route instructions",
  listenedRoute: "listened to Io's route instructions before leaving",
};

export const AFTERSIGN_IO_RETURNING_SESSION_LINES: readonly AftersignIoReturningSessionLine[] = (
  Object.keys(outcomeToLineKey) as AftersignIoReturningSessionOutcome[]
).map((outcome) => ({
  outcome,
  rememberedAction: rememberedActionByOutcome[outcome],
  line: authoredLines[outcomeToLineKey[outcome]],
}));

export function getAftersignIoReturningSessionLine(
  outcome: AftersignIoReturningSessionOutcome,
): AftersignIoReturningSessionLine {
  return AFTERSIGN_IO_RETURNING_SESSION_LINES.find((candidate) => candidate.outcome === outcome)!;
}
