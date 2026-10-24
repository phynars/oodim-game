import { describe, expect, it } from "vitest";
import {
  bootAftersignWindowGame,
  type AftersignWindowGameHarness,
} from "./bootWindowGame";

describe("third NPC reload acknowledgment", () => {
  it("persists red-tag delivery and resolves the acknowledgment after a returning visit", () => {
    const firstVisit = bootAftersignWindowGame();

    expect(
      firstVisit.getRememberingNpcDialogue("red-tag-recipient").lines,
    ).toEqual(["I am waiting for the red tag."]);

    firstVisit.deliverRedTagToThirdNpc();
    expect(firstVisit.getStoryState().state.npcs).toContainEqual(
      expect.objectContaining({
        id: "red-tag-recipient",
        memory: { redTagDeliveredToThirdNpc: true },
      }),
    );
    const saved = firstVisit.save();

    const returningVisit: AftersignWindowGameHarness = bootAftersignWindowGame();
    returningVisit.load(saved);

    expect(returningVisit.getStoryState().state.npcs).toContainEqual(
      expect.objectContaining({
        id: "red-tag-recipient",
        memory: { redTagDeliveredToThirdNpc: true },
      }),
    );
    expect(
      returningVisit.getRememberingNpcDialogue("red-tag-recipient").lines,
    ).toEqual([
      "You brought the red tag yourself. I remember the courier who did not leave it for the rain.",
    ]);
  });
});
