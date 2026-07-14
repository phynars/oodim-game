// Io Vale — returning-session copy for the AFTERSIGN vertical slice.
//
// This module owns the authored lines Io can speak after the player returns.
// Keep these lines short, concrete, and tied to auditable player actions so the
// story-state harness can prove Io is remembering the right thing.

export type AftersignIoPacketMemoryOutcome = "sealed" | "opened";

export type AftersignIoReturningLine = {
  readonly outcome: AftersignIoPacketMemoryOutcome;
  readonly memoryRef: string;
  readonly line: string;
};

export const AFTERSIGN_IO_RETURNING_LINES = {
  sealed: {
    outcome: "sealed",
    memoryRef: "packet:blue-seal-delivered-unopened",
    line: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  opened: {
    outcome: "opened",
    memoryRef: "packet:blue-seal-opened-before-delivery",
    line: "You came back. The seal did not. I can use one of those facts.",
  },
} as const satisfies Record<AftersignIoPacketMemoryOutcome, AftersignIoReturningLine>;

export function getAftersignIoReturningLine(
  outcome: AftersignIoPacketMemoryOutcome,
): AftersignIoReturningLine {
  return AFTERSIGN_IO_RETURNING_LINES[outcome];
}
