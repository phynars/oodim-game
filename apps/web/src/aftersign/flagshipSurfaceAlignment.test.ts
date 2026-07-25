import { describe, expect, it } from "vitest";

import {
  createAftersignWindowGameSurface,
  getAftersignStoryState,
} from "./verticalSliceState";

describe("Aftersign flagship surface alignment", () => {
  it("keeps the fast-lane snapshot tied to the vertical-slice story state", () => {
    const surface = createAftersignWindowGameSurface();
    const story = getAftersignStoryState(surface);

    expect(surface).toEqual(
      expect.objectContaining({
        story,
        state: expect.any(Object),
      }),
    );
    expect(story).toEqual(
      expect.objectContaining({
        scene: expect.any(Object),
        delivery: expect.any(Object),
        npcs: expect.any(Object),
        save: expect.any(Object),
      }),
    );
  });

  it("publishes the flagship feel anchors the e2e lane depends on", () => {
    const surface = createAftersignWindowGameSurface();
    const story = getAftersignStoryState(surface);

    expect(story.scene).toEqual(
      expect.objectContaining({
        act: expect.any(String),
        beat: expect.any(String),
      }),
    );
    expect(story.delivery).toEqual(
      expect.objectContaining({
        id: expect.any(String),
      }),
    );
    expect(story.npcs).toEqual(
      expect.objectContaining({
        io: expect.objectContaining({
          id: "io",
          memories: expect.any(Array),
        }),
      }),
    );
    expect(story.save).toEqual(
      expect.objectContaining({
        slot: expect.any(String),
      }),
    );
  });
});
