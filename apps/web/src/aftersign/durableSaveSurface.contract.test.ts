import { describe, expect, it } from "vitest";

import { getAftersignStoryState } from "./verticalSliceState";

describe("AFTERSIGN durable save surface contract", () => {
  it("exposes durable save metadata through the story/state snapshot", () => {
    const snapshot = getAftersignStoryState({
      save: {
        key: "aftersign.verticalSlice.v1",
        savedAtTurn: 31,
      },
    });

    expect(snapshot.state.save).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn: 31,
    });
  });
});
