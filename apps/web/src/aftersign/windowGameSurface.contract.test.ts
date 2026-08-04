import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

type AftersignHarnessWindow = {
  __game?: unknown;
};

const publishAftersignHarnessSnapshot = (
  hostWindow: AftersignHarnessWindow,
  snapshot: ReturnType<typeof getAftersignStoryState>,
) => {
  hostWindow.__game = snapshot;
};

describe("Aftersign window.__game story/state contract", () => {
  it("publishes a JSON-safe story/state snapshot for a durable Io return", () => {
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const savedPayload = encodeAftersignDurableSave(firstSession, 17);
    const returningSession = meetIoForAftersignSlice(restoreAftersignDurableSave(savedPayload));
    const snapshot = getAftersignStoryState(returningSession, {
      playerId: "player-persistent-17",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-before-hard-reload"],
    });

    const hostWindow: AftersignHarnessWindow = {};
    publishAftersignHarnessSnapshot(hostWindow, snapshot);

    expect(hostWindow.__game).toEqual({
      story: {
        id: "aftersign.verticalSlice",
        act: "act-1",
        beat: "io-remembers-opened-packet",
        completedBeats: ["packet-opened", "io-first-meeting", "io-remembers-opened-packet"],
        ioMemoryBeat: {
          scene: "io-return",
          recognizesPlayer: true,
          packetOutcome: "opened",
          recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
        },
      },
      state: {
        scene: "io-return",
        player: {
          id: "player-persistent-17",
          name: "Signal Runner",
        },
        save: {
          key: "aftersign.verticalSlice.v1",
          savedAtTurn: 17,
        },
        npcs: [
          {
            id: "io",
            name: "Io",
            disposition: "recognizes-player",
            rememberedSessionIds: ["session-before-hard-reload"],
            memory: {
              recognizesPlayer: true,
              packetOutcome: "opened",
            },
          },
        ],
      },
    });
    expect(JSON.parse(JSON.stringify(hostWindow.__game))).toEqual(hostWindow.__game);
  });
});
