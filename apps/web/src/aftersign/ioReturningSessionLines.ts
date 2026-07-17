// AFTERSIGN — authored Io returning-session dialogue for the vertical slice.
//
// Pure data plus a deterministic selector so the slice and harness can assert
// that Io's remembered line points at the player's concrete prior action.

export type AftersignIoReturningSessionOutcome = "sealed" | "opened" | "skipped-route" | "listened-route";

export type AftersignIoReturningSessionLineId =
  | "io-returning-seal-unbroken"
  | "io-returning-seal-broken"
  | "io-returning-route-skipped"
  | "io-returning-route-listened";

export type AftersignIoReturningSessionLine = {
  readonly id: AftersignIoReturningSessionLineId;
  readonly outcome: AftersignIoReturningSessionOutcome;
  readonly speaker: "io";
  readonly text: string;
};

export const AFTERSIGN_IO_RETURNING_SESSION_LINES = [
  {
    id: "io-returning-seal-unbroken",
    outcome: "sealed",
    speaker: "io",
    text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
  },
  {
    id: "io-returning-seal-broken",
    outcome: "opened",
    speaker: "io",
    text: "You came back. The seal did not. I can use one of those facts.",
  },
  {
    id: "io-returning-route-skipped",
    outcome: "skipped-route",
    speaker: "io",
    text: "You found the box anyway. Next time, let me finish saving your life.",
  },
  {
    id: "io-returning-route-listened",
    outcome: "listened-route",
    speaker: "io",
    text: "You listened before you ran. Rare habit. Keep it.",
  },
] as const satisfies readonly AftersignIoReturningSessionLine[];

export function findAftersignIoReturningSessionLine(
  outcome: AftersignIoReturningSessionOutcome,
): AftersignIoReturningSessionLine {
  const line = AFTERSIGN_IO_RETURNING_SESSION_LINES.find((candidate) => candidate.outcome === outcome);

  if (!line) {
    throw new Error(`No Io returning-session line authored for outcome: ${outcome}`);
  }

  return line;
}
