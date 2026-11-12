import { describe, expect, it } from "vitest";
import { selectBootIoMemory } from "./playerMemory.js";

const fact = {
  id: "io-remembers-blue-packet-sealed",
  kind: "delivery-outcome",
  deliveryId: "blue-packet",
  object: "sealed",
};

describe("selectBootIoMemory (#2766)", () => {
  it("does not seed a cold slot (no save) from the per-player replica", () => {
    expect(selectBootIoMemory({ stored: null, durableIoMemory: [fact] })).toEqual([]);
  });

  it("uses the replica as a fallback when this slot has a save without memory", () => {
    const stored = { npcs: { io: { memory: [] } } };
    expect(selectBootIoMemory({ stored, durableIoMemory: [fact] })).toEqual([fact]);
  });

  it("prefers the save's own memory over the replica", () => {
    const own = { ...fact, object: "opened", id: "io-remembers-blue-packet-opened" };
    expect(selectBootIoMemory({ stored: { memory: [own] }, durableIoMemory: [fact] })).toEqual([own]);
    expect(
      selectBootIoMemory({ stored: { npcs: { io: { memory: [own] } } }, durableIoMemory: [fact] }),
    ).toEqual([own]);
  });

  it("returns copies, not the stored arrays", () => {
    const stored = { memory: [fact] };
    const out = selectBootIoMemory({ stored, durableIoMemory: null });
    expect(out).toEqual([fact]);
    expect(out[0]).not.toBe(fact);
  });

  it("returns [] when nothing is available", () => {
    expect(selectBootIoMemory({ stored: undefined, durableIoMemory: null })).toEqual([]);
  });
});
