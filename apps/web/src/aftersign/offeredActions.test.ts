import { describe, expect, it } from "vitest";
import { computeOfferedActions } from "./offeredActions";

describe("computeOfferedActions", () => {
  it("gives divergent saved outcomes different action sets", () => {
    expect(
      computeOfferedActions({
        returnTone: "warm",
        packetOutcome: "opened",
        orraAction: null,
      }),
    ).toEqual([{ id: "carry-opened-packet", label: "Carry what was opened" }]);

    expect(
      computeOfferedActions({
        returnTone: "cold",
        packetOutcome: "sealed",
        orraAction: null,
      }),
    ).toEqual([{ id: "carry-sealed-packet", label: "Carry what stayed sealed" }]);
  });

  it("lets Orra's remembered answer replace the packet job", () => {
    expect(
      computeOfferedActions({
        packetOutcome: "opened",
        orraAction: "answered-saint-orra",
      }),
    ).toEqual([{ id: "answer-for-orra", label: "Carry a reply for Orra" }]);
  });
});
