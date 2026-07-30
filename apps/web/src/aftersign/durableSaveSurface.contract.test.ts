import { describe, expect, it } from "vitest";

import { getAftersignStoryState } from "./verticalSliceState";

const SAVE_KEY = "aftersign.verticalSlice.v1";

describe("AFTERSIGN durable save surface", () => {
  it("surfaces the durable save turn on the published state snapshot", () => {
    const savedAtTurn = 31;
    const snapshot = getAftersignStoryState({
      save: {
        key: SAVE_KEY,
        savedAtTurn,
      },
    });

    expect(snapshot.state.save).toEqual({
      key: SAVE_KEY,
      savedAtTurn,
    });
  });
});
