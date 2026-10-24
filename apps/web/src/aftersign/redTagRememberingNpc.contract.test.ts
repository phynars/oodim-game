import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  recordAftersignThirdNpcRedTagDelivery,
  resolveAftersignRememberingNpcDialogue,
  SAINT_ORRA_RED_TAG_RETURN_ACKNOWLEDGMENT_ID,
} from "./verticalSliceRuntimeState";
import {
  encodeAftersignDurableSave,
  restoreAftersignDurableSave,
} from "./verticalSliceDurableSave";
import { getAftersignStoryState } from "./windowGameSurface";

describe("third red-tag remembering NPC", () => {
  it("greets on first visit, then acknowledges by ID after delivery and reload (#2448)", () => {
    // (1) First visit: no flag, default greeting, no acknowledgment ID.
    const fresh = createAftersignVerticalSliceState();
    expect(fresh.redTagDeliveredToThirdNpc).toBe(false);
    const greeting = resolveAftersignRememberingNpcDialogue(fresh, "red-tag-recipient");
    expect(greeting.recognizesPlayer).toBe(false);
    expect(greeting.lines).toEqual(["I am waiting for the red tag."]);
    expect(greeting.acknowledgmentId).toBeNull();

    // (2) Red-tag delivery completes and the flag is set.
    const delivered = recordAftersignThirdNpcRedTagDelivery(fresh);
    expect(delivered.redTagDeliveredToThirdNpc).toBe(true);

    // (3) Reload: round-trip through the durable save encoding.
    const reloaded = restoreAftersignDurableSave(
      encodeAftersignDurableSave(delivered, 1),
    );
    expect(reloaded.redTagDeliveredToThirdNpc).toBe(true);

    // (4) Return visit renders the acknowledgment line + stable ID.
    const acknowledgment = resolveAftersignRememberingNpcDialogue(
      reloaded,
      "red-tag-recipient",
    );
    expect(acknowledgment.recognizesPlayer).toBe(true);
    expect(acknowledgment.acknowledgmentId).toBe(
      SAINT_ORRA_RED_TAG_RETURN_ACKNOWLEDGMENT_ID,
    );
    expect(acknowledgment.acknowledgmentId).toBe("saint-orra-red-tag-return");
    expect(acknowledgment.lines).toEqual([
      "You brought the red tag yourself. I remember the courier who did not leave it for the rain.",
    ]);
  });

  it("persists a completed delivery and resolves acknowledgment dialogue after restore", () => {
    const delivered = recordAftersignThirdNpcRedTagDelivery(
      createAftersignVerticalSliceState(),
    );
    const restored = restoreAftersignDurableSave(
      encodeAftersignDurableSave(delivered, 1),
    );

    expect(restored.redTagDeliveredToThirdNpc).toBe(true);
    expect(resolveAftersignRememberingNpcDialogue(restored, "red-tag-recipient").lines).toEqual([
      "You brought the red tag yourself. I remember the courier who did not leave it for the rain.",
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
