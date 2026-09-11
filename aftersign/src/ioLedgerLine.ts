export type IoLedgerFact = "sealed" | "opened" | "returned";

const ledgerLines: Record<IoLedgerFact, string> = {
  sealed: "The seal held. That buys you the longer route.",
  opened: "The seal broke. Take the route with fewer witnesses.",
  returned: "You came back. I kept the work that remembers that.",
};

/**
 * Io names a concrete fact, then puts its consequence to work.
 */
export function chooseIoLedgerLine(fact: IoLedgerFact): string {
  return ledgerLines[fact];
}
