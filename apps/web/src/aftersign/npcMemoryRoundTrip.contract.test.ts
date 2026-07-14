import { describe, expect, it } from "vitest";

import { createNpcMemoryRoundTrip } from "./npcMemoryRoundTrip";

describe("AFTERSIGN NPC memory round-trip contract", () => {
  it("lets Io correctly reference the player's prior-session choice after reload", async () => {
    const firstSession = createNpcMemoryRoundTrip({
      playerId: "player-soren-contract",
      npcId: "io",
    });

    await firstSession.recordPlayerChoice({
      beatId: "packet-seal",
      choiceId: "opened-the-sealed-packet",
      summary: "The player opened the sealed packet instead of walking away.",
    });

    const secondSession = await firstSession.reload();
    const recall = await secondSession.recallForNpc("io");

    expect(recall).toMatchObject({
      npcId: "io",
      playerId: "player-soren-contract",
      referencedBeatId: "packet-seal",
      referencedChoiceId: "opened-the-sealed-packet",
    });
    expect(recall.line).toContain("sealed packet");
    expect(recall.line).not.toContain("walked away");
  });
});
