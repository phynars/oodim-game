import { describe, expect, it } from "vitest";
import {
  getIoPacketReturningLine,
  getIoReturningLines,
  getIoRouteReturningLine,
  getIoToneReturningLine,
} from "./io-memory-lines";

describe("Io memory lines", () => {
  it("anchors the sealed-packet returning line to the exact remembered action", () => {
    expect(getIoPacketReturningLine("sealed")).toEqual({
      id: "io.return.packet.sealed",
      text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      references: ["player_returned", "packet_delivered_sealed"],
    });
  });

  it("anchors the opened-packet returning line to the exact remembered action", () => {
    expect(getIoPacketReturningLine("opened")).toEqual({
      id: "io.return.packet.opened",
      text: "You came back. The seal did not. I can use one of those facts.",
      references: ["player_returned", "packet_opened"],
    });
  });

  it("keeps route-attention memory concrete instead of generic affinity", () => {
    expect(getIoRouteReturningLine("listened").references).toEqual([
      "route_instructions_completed",
    ]);
    expect(getIoRouteReturningLine("skipped")).toEqual({
      id: "io.return.route.skipped",
      text: "You found the box anyway. Next time, let me finish saving your life.",
      references: ["route_instructions_skipped"],
    });
  });

  it("keeps return-tone variants short and auditable", () => {
    expect(getIoToneReturningLine("kind").text).toBe(
      "Kind answer. Dangerous habit here. Not useless.",
    );
    expect(getIoToneReturningLine("evasive").references).toEqual([
      "return_answer_evasive",
    ]);
    expect(getIoToneReturningLine("blunt").id).toBe("io.return.tone.blunt");
  });

  it("composes only the lines backed by stored slice memory", () => {
    expect(
      getIoReturningLines({
        packetOutcome: "sealed",
        routeAttention: "listened",
        returnTone: "blunt",
      }).map((line) => line.id),
    ).toEqual([
      "io.return.packet.sealed",
      "io.return.route.listened",
      "io.return.tone.blunt",
    ]);
  });
});
