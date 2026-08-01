import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

const STORY_STATE_OPTIONS = {
  playerId: "player-story-state",
  playerName: "Mara",
};

describe("Aftersign story/state surface invariants", () => {
  it("keeps the canonical story beat inside the completed beat set without duplicates", () => {
    const state = meetIoForAftersignSlice(createAftersignVerticalSliceState(), {
      displayName: "Mara",
    });

    const snapshot = getAftersignStoryState(state, STORY_STATE_OPTIONS);

    expect(snapshot.story.beat).toBeTruthy();
    expect(snapshot.story.completedBeats).toContain(snapshot.story.beat);
    expect(new Set(snapshot.story.completedBeats).size).toBe(snapshot.story.completedBeats.length);
  });

  it("surfaces durable save metadata beside Io's returning-player memory after restore", () => {
    const firstVisit = meetIoForAftersignSlice(createAftersignVerticalSliceState(), {
      displayName: "Mara",
    });

    const save = encodeAftersignDurableSave(firstVisit, 7);
    const returnVisit = meetIoForAftersignSlice(restoreAftersignDurableSave(save), {
      displayName: "Mara",
    });
    const snapshot = getAftersignStoryState(returnVisit, STORY_STATE_OPTIONS);

    expect(snapshot.state.save).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn: 7,
    });
    expect(snapshot.state.npcs).toContainEqual(
      expect.objectContaining({
        id: "io",
        disposition: "recognizes-player",
      }),
    );
  });
});
