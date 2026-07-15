import { describe, expect, test } from "vitest";

import { createNpcMemoryRoundTrip } from "./npcMemoryRoundTrip";

describe("AFTERSIGN NPC memory round-trip contract", () => {
  test("Io references a prior-session player choice after reload", () => {
    const memory = createNpcMemoryRoundTrip();

    memory.remember({
      id: "packet-seal",
      playerId: "player-soren-contract",
      choice: {
        id: "opened-the-sealed-packet",
        summary: "opened the sealed packet",
      },
    });

    const reloadedMemory = memory.reload();
    const recall = reloadedMemory.recallFor("io", "player-soren-contract");

    expect(recall).toEqual({
      npcId: "io",
      playerId: "player-soren-contract",
      referencedBeatId: "packet-seal",
      referencedChoiceId: "opened-the-sealed-packet",
      line: expect.stringContaining("sealed packet"),
    });
    expect(recall?.line).not.toContain("walked away");
  });
});
