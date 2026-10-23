import { beforeEach, describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
} from "./verticalSliceState";
import { THIRD_NPC_RED_TAG_TARGET_SELECTOR } from "./harness/thirdNpcDeliveryTarget";
import "./harness/bootWindowGame";

describe("third NPC red-tag delivery target", () => {
  beforeEach(() => {
    window.__game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
  });

  it("records delivery from the target's click and retains it through save/load", () => {
    const game = window.__game;
    const target = document.querySelector<HTMLElement>(
      THIRD_NPC_RED_TAG_TARGET_SELECTOR,
    );
    expect(game).toBeDefined();
    expect(target).not.toBeNull();

    const beforeDelivery = game?.getRememberingNpcDialogue("red-tag-recipient");
    target?.click();
    const afterDelivery = game?.getRememberingNpcDialogue("red-tag-recipient");
    expect(afterDelivery).not.toEqual(beforeDelivery);

    const saved = game?.save();
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 2),
    );
    game?.load(saved ?? "");
    expect(game?.getRememberingNpcDialogue("red-tag-recipient")).toEqual(
      afterDelivery,
    );
  });
});
