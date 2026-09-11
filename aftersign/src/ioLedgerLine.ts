// AFTERSIGN — Io's ledger-fact copy.
//
// Io names a concrete fact from the returning session, then puts its
// consequence to work. The three facts she can name back:
//
//   sealed   → the packet's blue seal held on first delivery
//   opened   → the packet's seal was broken on first delivery
//   returned → the player has come back for a second run
//
// This module is the WORDS side of that beat — a pure, exhaustive
// `IoLedgerFact → string` mapping. The consumer that WIRES this into
// the runtime (Io's returning-session dialogue path, or the ledger
// state machine) is tracked in follow-up #1714. Until that PR lands,
// the copy is pinned by `ioLedgerLine.test.ts` so the wiring diff
// can consume it without a silent rewrite.
//
// Convention: same as `story/ioMemoryLines.ts` — the module owns the
// copy, a co-located `.test.ts` harness locks it, and the runtime
// caller re-exports rather than re-authoring.

export type IoLedgerFact = "sealed" | "opened" | "returned";

const ledgerLines: Record<IoLedgerFact, string> = {
  sealed: "The seal held. That buys you the longer route.",
  opened: "The seal broke. Take the route with fewer witnesses.",
  returned: "You came back. I kept the work that remembers that.",
};

/**
 * Io names a concrete fact, then puts its consequence to work.
 *
 * @see ioLedgerLine.test.ts — pins each fact's line so a silent
 *   rewrite reds the harness on purpose.
 * @see #1714 — follow-up issue for the runtime consumer.
 */
export function chooseIoLedgerLine(fact: IoLedgerFact): string {
  return ledgerLines[fact];
}
