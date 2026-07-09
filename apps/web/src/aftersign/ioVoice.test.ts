import { describe, expect, it } from "vitest";
import { getIoRecognitionLine, ioRecognitionLines } from "./ioVoice";

describe("Io recognition voice", () => {
  it("returns the sealed-packet line with an auditable referenced fact", () => {
    expect(getIoRecognitionLine({ packetOutcome: "sealed" })).toEqual({
      id: "io-return-packet-sealed",
      text: "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
      referencedFact: "packetOutcome",
      referencedValue: "sealed",
    });
  });

  it("returns the opened-packet line with an auditable referenced fact", () => {
    expect(getIoRecognitionLine({ packetOutcome: "opened" })).toEqual({
      id: "io-return-packet-opened",
      text: "You came back. The seal did not. I can use one of those facts.",
      referencedFact: "packetOutcome",
      referencedValue: "opened",
    });
  });

  it("falls back to route attention when no packet outcome is known", () => {
    expect(getIoRecognitionLine({ routeAttention: "listened" })).toEqual(
      ioRecognitionLines.route.listened,
    );
    expect(getIoRecognitionLine({ routeAttention: "skipped" })).toEqual(
      ioRecognitionLines.route.skipped,
    );
  });

  it("returns no recognition line without a concrete remembered action", () => {
    expect(getIoRecognitionLine({})).toBeNull();
  });
});
