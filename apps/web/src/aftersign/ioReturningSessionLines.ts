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

export const AFTERSIGN_IO_RETURNING_SESSION_LINES: readonly AftersignIoReturningSessionLine[] = [
  {
    outcome: "sealed",
    rememberedAction: "delivered the blue packet with its seal unbroken",
    line: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  {
    outcome: "opened",
    rememberedAction: "opened the blue packet before returning",
    line: "You came back. The seal did not. I can use one of those facts.",
  },
  {
    outcome: "skippedRoute",
    rememberedAction: "left before Io finished the route instructions",
    line: "You found the box anyway. Next time, let me finish saving your life.",
  },
  {
    outcome: "listenedRoute",
    rememberedAction: "listened to Io's route instructions before leaving",
    line: "You listened before you ran. Rare habit. Keep it.",
  },
] as const;

export function getAftersignIoReturningSessionLine(
  outcome: AftersignIoReturningSessionOutcome,
): AftersignIoReturningSessionLine {
  return AFTERSIGN_IO_RETURNING_SESSION_LINES.find((candidate) => candidate.outcome === outcome)!;
}
