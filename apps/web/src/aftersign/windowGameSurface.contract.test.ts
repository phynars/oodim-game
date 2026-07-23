import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";
import { createAftersignWindowGameSurface } from "./windowGameSurface";

describe("Aftersign window.__game surface contract", () => {
  it("publishes a story/state snapshot through the headless runtime surface after durable restore", () => {
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const restoredSession = meetIoForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(firstSession, 9)),
    );

    const game = createAftersignWindowGameSurface(restoredSession, {
      playerId: "player-persistent-9",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-before-refresh"],
    });

    expect(game.getStoryState()).toEqual({
      story: {
        id: "aftersign.verticalSlice",
        act: "act-1",
        beat: "io-remembers-sealed-packet",
        completedBeats: [
          "packet-sealed",
          "io-first-meeting",
          "io-remembers-sealed-packet",
        ],
      },
      state: {
        scene: "io-return",
        player: {
          id: "player-persistent-9",
          name: "Signal Runner",
        },
        npcs: [
          {
            id: "io",
            name: "Io",
            disposition: "recognizes-player",
            rememberedSessionIds: ["session-before-refresh"],
            memory: {
              recognizesPlayer: true,
              packetOutcome: "sealed",
            },
          },
        ],
      },
    });
  });
});
