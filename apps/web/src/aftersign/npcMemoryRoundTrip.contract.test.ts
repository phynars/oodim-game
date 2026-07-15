import { describe, expect, test } from "vitest";

import { createNpcMemoryRoundTrip } from "./npcMemoryRoundTrip";

describe("AFTERSIGN NPC memory round-trip contract", () => {
  test("Io references a prior-session player choice after save + rehydrate", () => {
    const memory = createNpcMemoryRoundTrip();

    memory.remember({
      id: "packet-seal",
      playerId: "player-soren-contract",
      choice: {
        id: "opened-the-sealed-packet",
        summary: "opened the sealed packet",
      },
    });

    // Cross the persistence boundary: serialize to the snapshot shape and
    // rehydrate a fresh instance, so a regression in save() OR in the
    // constructor's snapshot rehydration path breaks this test.
    const snapshot = memory.save();
    const rehydratedMemory = createNpcMemoryRoundTrip(snapshot);
    const recall = rehydratedMemory.recallFor("io", "player-soren-contract");

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
