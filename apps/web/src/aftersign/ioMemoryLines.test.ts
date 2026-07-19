import { describe, expect, it } from "vitest";

import {
  getIoReturnLine,
  IO_PACKET_MEMORY_LINES,
  IO_POSTURE_MEMORY_LINES,
  IO_ROUTE_MEMORY_LINES,
} from "./ioMemoryLines";

describe("Io memory lines", () => {
  it("returns the sealed-packet recognition line before lower-priority memories", () => {
    expect(
      getIoReturnLine({
        packetOutcome: "sealed",
        routeBehavior: "skipped",
        returnPosture: "blunt",
      }),
    ).toEqual(IO_PACKET_MEMORY_LINES.sealed);
  });

  it("returns the opened-packet recognition line", () => {
    expect(getIoReturnLine({ packetOutcome: "opened" })).toEqual(IO_PACKET_MEMORY_LINES.opened);
  });

  it("ties route lines to concrete route behavior", () => {
    expect(IO_ROUTE_MEMORY_LINES.listened).toMatchObject({
      remembers: "routeBehavior",
      value: "listened",
    });
    expect(IO_ROUTE_MEMORY_LINES.skipped).toMatchObject({
      remembers: "routeBehavior",
      value: "skipped",
    });
  });

  it("ties posture lines to concrete return posture", () => {
    expect(IO_POSTURE_MEMORY_LINES.kind).toMatchObject({
      remembers: "returnPosture",
      value: "kind",
    });
    expect(IO_POSTURE_MEMORY_LINES.evasive).toMatchObject({
      remembers: "returnPosture",
      value: "evasive",
    });
    expect(IO_POSTURE_MEMORY_LINES.blunt).toMatchObject({
      remembers: "returnPosture",
      value: "blunt",
    });
  });

  it("keeps a fallback for returning players before a packet outcome exists", () => {
    expect(getIoReturnLine({})).toMatchObject({
      id: "io.return.default",
      text: "You came back. Good. The city keeps receipts.",
      remembers: "packetOutcome",
      value: "returned",
    });
  });
});
