import { describe, expect, it } from "vitest";

import { IO_FIRST_BRIEFING_LINES, selectIoReturningLines } from "./io-memory-lines";

describe("Io memory lines", () => {
  it("does not expose returning lines before a second session", () => {
    expect(
      selectIoReturningLines({
        returnedAfterFirstSession: false,
        packetOutcome: "sealed",
        routeInstructionOutcome: "listened",
        returnTone: "kind",
      }),
    ).toEqual([]);
  });

  it("selects the sealed-packet memory line after return", () => {
    expect(
      selectIoReturningLines({
        returnedAfterFirstSession: true,
        packetOutcome: "sealed",
        routeInstructionOutcome: "unknown",
        returnTone: "unknown",
      }),
    ).toEqual([
      {
        id: "io-return-packet-sealed",
        kind: "packet-memory",
        text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      },
    ]);
  });

  it("selects the opened-packet memory line after return", () => {
    expect(
      selectIoReturningLines({
        returnedAfterFirstSession: true,
        packetOutcome: "opened",
        routeInstructionOutcome: "unknown",
        returnTone: "unknown",
      }),
    ).toEqual([
      {
        id: "io-return-packet-opened",
        kind: "packet-memory",
        text: "You came back. The seal did not. I can use one of those facts.",
      },
    ]);
  });

  it("keeps briefing copy concrete and short", () => {
    expect(IO_FIRST_BRIEFING_LINES.map((line) => line.text)).toEqual([
      "Night Post needs legs, not a legend. You have legs.",
      "Blue seal stays closed. If it opens, make sure your reason is heavier than curiosity.",
      "Three lanterns up, brass stair left, sign box under the moth light. Repeat that if you plan to live.",
    ]);
  });
});
