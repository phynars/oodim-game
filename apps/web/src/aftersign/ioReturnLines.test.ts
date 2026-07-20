import { describe, expect, it } from "vitest";

import { AFTERSIGN_IO_RETURN_LINES, getIoReturnLine } from "./ioReturnLines";

describe("Io returning-session lines", () => {
  it("names the sealed packet outcome before softer route memory", () => {
    expect(
      getIoReturnLine({ packetOutcome: "sealed", routeMemory: "skipped" }),
    ).toEqual(AFTERSIGN_IO_RETURN_LINES.packet.sealed);
  });

  it("names the opened packet outcome before softer posture memory", () => {
    expect(
      getIoReturnLine({ packetOutcome: "opened", returnPosture: "kind" }),
    ).toEqual(AFTERSIGN_IO_RETURN_LINES.packet.opened);
  });

  it("keeps route lines tied to the concrete route behavior Io remembers", () => {
    expect(getIoReturnLine({ routeMemory: "listened" })).toMatchObject({
      id: "io.return.route.listened",
      remembers: "routeMemory",
      text: "You listened before you ran. Rare habit. Keep it.",
    });

    expect(getIoReturnLine({ routeMemory: "skipped" })).toMatchObject({
      id: "io.return.route.skipped",
      remembers: "routeMemory",
      text: "You found the box anyway. Next time, let me finish saving your life.",
    });
  });

  it("keeps posture lines tied to the concrete answer posture Io remembers", () => {
    expect(getIoReturnLine({ returnPosture: "kind" })).toMatchObject({
      id: "io.return.posture.kind",
      remembers: "returnPosture",
      text: "You softened the answer. I noticed. So will the city.",
    });

    expect(getIoReturnLine({ returnPosture: "evasive" })).toMatchObject({
      id: "io.return.posture.evasive",
      remembers: "returnPosture",
      text: "You walked around the question. Efficient. Not invisible.",
    });

    expect(getIoReturnLine({ returnPosture: "blunt" })).toMatchObject({
      id: "io.return.posture.blunt",
      remembers: "returnPosture",
      text: "You answered like a door closing. Useful, if the hinge holds.",
    });
  });
});
