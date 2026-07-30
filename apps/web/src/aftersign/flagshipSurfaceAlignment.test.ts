import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";

describe("Aftersign flagship surface alignment", () => {
  it("pins the vertical-slice story/state fields the flagship window surface depends on", () => {
    const state = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );

    const snapshot = getAftersignStoryState(state, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
    });

    expect(snapshot).toMatchObject({
      story: {
        id: "aftersign.verticalSlice",
        act: "act-1",
        beat: "io-first-meeting",
        completedBeats: ["packet-opened", "io-first-meeting"],
      },
      state: {
        scene: "io-return",
        player: {
          id: "player-persistent-7",
          name: "Signal Runner",
        },
        npcs: [
          {
            id: "io",
            name: "Io",
            disposition: "met-player",
            rememberedSessionIds: [],
            memory: {
              recognizesPlayer: false,
              packetOutcome: "opened",
            },
          },
        ],
      },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
