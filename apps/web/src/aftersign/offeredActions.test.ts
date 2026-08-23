import { describe, expect, it } from "vitest";
import { computeOfferedActions } from "./offeredActions";

describe("computeOfferedActions", () => {
  it("gives divergent packet outcomes different action sets", () => {
    expect(
      computeOfferedActions({
        returnTone: "plain",
        packetOutcome: "opened",
        orraAction: null,
      }),
    ).toEqual([{ id: "carry-opened-packet", label: "Carry what was opened" }]);

    expect(
      computeOfferedActions({
        returnTone: "plain",
        packetOutcome: "sealed",
        orraAction: null,
      }),
    ).toEqual([{ id: "carry-sealed-packet", label: "Carry what stayed sealed" }]);
  });

  it("diverges on returnTone alone when packetOutcome is held constant", () => {
    // Two saves that agree on every axis EXCEPT returnTone must still
    // expose different tappable action ids — this is the axis the
    // #1370 done-gate exercises when it seeds "same outcome, different
    // tone" and demands element-level divergence.
    const warm = computeOfferedActions({
      returnTone: "warm",
      packetOutcome: "sealed",
      orraAction: null,
    });
    const cold = computeOfferedActions({
      returnTone: "cold",
      packetOutcome: "sealed",
      orraAction: null,
    });
    expect(warm).toEqual([
      { id: "carry-sealed-packet-warm", label: "Carry what stayed sealed (warm return)" },
    ]);
    expect(cold).toEqual([
      { id: "carry-sealed-packet-cold", label: "Carry what stayed sealed (cold return)" },
    ]);
    expect(warm[0]!.id).not.toBe(cold[0]!.id);
  });

  it("lets Orra's remembered answer replace the packet job", () => {
    expect(
      computeOfferedActions({
        packetOutcome: "opened",
        orraAction: "answered-saint-orra",
      }),
    ).toEqual([{ id: "answer-for-orra", label: "Carry a reply for Orra" }]);
  });

  it("threads returnTone into the Orra branch too", () => {
    expect(
      computeOfferedActions({
        returnTone: "warm",
        packetOutcome: "opened",
        orraAction: "answered-saint-orra",
      }),
    ).toEqual([
      { id: "answer-for-orra-warm", label: "Carry a reply for Orra (warm return)" },
    ]);
  });

  it("treats a missing / unset returnTone as the neutral base (id unchanged)", () => {
    expect(
      computeOfferedActions({
        packetOutcome: "sealed",
        orraAction: null,
      }),
    ).toEqual([{ id: "carry-sealed-packet", label: "Carry what stayed sealed" }]);
  });
});
