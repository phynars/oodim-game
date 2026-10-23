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

  // Locks F1: pre-delivery, the third NPC must NOT appear in the
  // surface npcs array. Existing exact-match assertions in sibling
  // contract tests (`durableSave.contract.test.ts:321/376`,
  // `windowGameSurface.contract.test.ts:72`,
  // `harness/windowGameHarnessBoot.test.ts:80/210`) expect `[io]` or
  // `[io, orra]` only; this test is the single-point-of-failure
  // guarding that gating so a future refactor can't silently
  // re-introduce the unconditional append.
  it("omits the third NPC from the surface npcs array before delivery", () => {
    const fresh = createAftersignVerticalSliceState();
    const snapshot = getAftersignStoryState(fresh, {
      playerId: "player",
      playerName: "Player",
    });
    expect(
      snapshot.state.npcs.some((npc) => npc.id === "red-tag-recipient"),
    ).toBe(false);
  });
});
