import { describe, expect, it } from "vitest";
import {
  ioReturningSessionLines as authoredLines,
  type IoReturningSessionLineKey,
} from "./ioReturningSession";
import {
  AFTERSIGN_IO_RETURNING_SESSION_LINES,
  getAftersignIoReturningSessionLine,
  type AftersignIoReturningSessionOutcome,
} from "./ioReturningSessionLines";

// Cross-vocabulary map the web view relies on. Asserted here (independent
// of the map inside the module) so a rename in either the outcome or the
// line-key vocabulary trips this test instead of drifting silently — this
// is the ONLY thing catching drift between the authority and the web view.
const outcomeToLineKey: Record<AftersignIoReturningSessionOutcome, IoReturningSessionLineKey> = {
  sealed: "sealedPacket",
  opened: "openedPacket",
  skippedRoute: "skippedRoute",
  listenedRoute: "listenedRoute",
};

describe("AFTERSIGN Io returning-session lines (web view)", () => {
  it("reads every line from the aftersign authority package — no duplicated strings", () => {
    for (const outcome of Object.keys(outcomeToLineKey) as AftersignIoReturningSessionOutcome[]) {
      const entry = getAftersignIoReturningSessionLine(outcome);
      expect(entry.line).toBe(authoredLines[outcomeToLineKey[outcome]]);
    }
  });

  it("exposes an entry for every outcome, in a stable order", () => {
    expect(AFTERSIGN_IO_RETURNING_SESSION_LINES.map((entry) => entry.outcome)).toEqual([
      "sealed",
      "opened",
      "skippedRoute",
      "listenedRoute",
    ]);
  });

  it("keeps every outcome tied to a concrete remembered player action", () => {
    for (const entry of AFTERSIGN_IO_RETURNING_SESSION_LINES) {
      expect(entry.rememberedAction).not.toHaveLength(0);
      // Guard against the temptation to encode trust-point deltas as prose;
      // rememberedAction is meant to describe a physical player choice.
      expect(entry.rememberedAction).not.toMatch(/trust \+\d/i);
    }
  });
});
