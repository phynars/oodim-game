import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  createAftersignWindowGameSurface,
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

  it("wires Io's dialogue module into the surface — kiosk lines always, return beat gated on the packet fork", () => {
    // Pre-commit: scene is 'kiosk', no packetOutcome — kiosk lines
    // only, no returnBeat. This asserts the seam between the dialogue
    // module and the surface, not the module in isolation.
    const preCommit = createAftersignWindowGameSurface(
      createAftersignVerticalSliceState(),
      { playerId: "p", playerName: "P" },
    ).getStoryState();

    expect(preCommit.story.ioDialogue.kioskLines.map((line) => line.id)).toEqual([
      "arrival",
      "route",
      "packetOffer",
    ]);
    expect(preCommit.story.ioDialogue.kioskLines[0].text).toContain(
      "Vey still owes you a name",
    );
    expect(preCommit.story.ioDialogue.returnBeat).toBeUndefined();

    // Sealed-return with default (skipped) route: the return beat
    // pairs the sealed-packet memory line with the skipped-route
    // memory line. Assert the exact memoryKeys the reviewer named so a
    // future dialogue rename fails HERE, at the surface seam.
    const sealedReturn = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const sealedSnapshot = createAftersignWindowGameSurface(sealedReturn, {
      playerId: "p",
      playerName: "P",
    }).getStoryState();

    expect(sealedSnapshot.story.ioDialogue.returnBeat).toEqual({
      packetLine: expect.objectContaining({
        id: "sealedReturn",
        memoryKey: "io_return_packet_sealed",
      }),
      routeLine: expect.objectContaining({
        id: "skippedReturn",
        memoryKey: "skipped_route",
      }),
    });

    // Opened + listenedToRoute: the alternate branch on both axes.
    // Asserted explicitly so a divergence in either memoryKey is a
    // failing harness assertion, not a silent story-beat drift.
    const openedReturn = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const openedSnapshot = createAftersignWindowGameSurface(openedReturn, {
      playerId: "p",
      playerName: "P",
      listenedToRoute: true,
    }).getStoryState();

    expect(openedSnapshot.story.ioDialogue.returnBeat).toEqual({
      packetLine: expect.objectContaining({
        memoryKey: "io_return_packet_opened",
      }),
      routeLine: expect.objectContaining({
        memoryKey: "listened_to_route",
      }),
    });
  });
});
