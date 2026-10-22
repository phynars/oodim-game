import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  recordAftersignThirdNpcRedTagDelivery,
  resolveAftersignRememberingNpcDialogue,
} from "./verticalSliceRuntimeState";
import {
  encodeAftersignDurableSave,
  restoreAftersignDurableSave,
} from "./verticalSliceDurableSave";
import { getAftersignStoryState } from "./windowGameSurface";

describe("third red-tag remembering NPC", () => {
  it("persists a completed delivery and resolves acknowledgment dialogue after restore", () => {
    const delivered = recordAftersignThirdNpcRedTagDelivery(
      createAftersignVerticalSliceState(),
    );
    const restored = restoreAftersignDurableSave(
      encodeAftersignDurableSave(delivered, 1),
    );

    expect(restored.redTagDeliveredToThirdNpc).toBe(true);
    expect(resolveAftersignRememberingNpcDialogue(restored, "red-tag-recipient").lines).toEqual([
      "Red tag received. I kept its mark under your name.",
    ]);
    expect(
      getAftersignStoryState(restored, { playerId: "player", playerName: "Player" }).state.npcs,
    ).toContainEqual({
      id: "red-tag-recipient",
      name: "Red Tag Recipient",
      disposition: "recognizes-player",
      rememberedSessionIds: [],
      memory: { redTagDeliveredToThirdNpc: true },
    });
  });

  it("resolves the third NPC's default greeting before delivery", () => {
    expect(
      resolveAftersignRememberingNpcDialogue(
        createAftersignVerticalSliceState(),
        "red-tag-recipient",
      ).lines,
    ).toEqual(["I am waiting for the red tag."]);
  });
});
