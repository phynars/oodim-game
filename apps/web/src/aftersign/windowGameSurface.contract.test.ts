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

    const snapshot = game.getStoryState();

    // Assert Io's spoken dialogue is wired through the surface — this
    // is what makes `ioFirstSceneDialogue` runnable slice code rather
    // than a test-only module. Kiosk lines are always present; the
    // return beat lands because the sealed-packet session is past the
    // fork commit.
    expect(snapshot.story.ioDialogue.kioskLines.map((line) => line.id)).toEqual([
      "arrival",
      "route",
      "packetOffer",
    ]);
    expect(snapshot.story.ioDialogue.returnBeat).toEqual({
      packetLine: expect.objectContaining({
        id: "sealedReturn",
        memoryKey: "io_return_packet_sealed",
      }),
      routeLine: expect.objectContaining({
        id: "skippedReturn",
        memoryKey: "skipped_route",
      }),
    });

    expect(snapshot.story.ioDialogue.kioskLines[0].text).toContain(
      "Vey still owes you a name",
    );

    expect(snapshot).toMatchObject({
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

  it("omits the return beat until the packet fork commits, and honors listenedToRoute", () => {
    // Pre-commit: scene is 'kiosk', no packetOutcome — kiosk lines only.
    const preCommit = createAftersignWindowGameSurface(
      createAftersignVerticalSliceState(),
      { playerId: "p", playerName: "P" },
    ).getStoryState();
    expect(preCommit.story.ioDialogue.kioskLines).toHaveLength(3);
    expect(preCommit.story.ioDialogue.returnBeat).toBeUndefined();

    // Post-commit + listenedToRoute: opens the 'listened_to_route' branch.
    const opened = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const postCommit = createAftersignWindowGameSurface(opened, {
      playerId: "p",
      playerName: "P",
      listenedToRoute: true,
    }).getStoryState();
    expect(postCommit.story.ioDialogue.returnBeat).toEqual({
      packetLine: expect.objectContaining({
        memoryKey: "io_return_packet_opened",
      }),
      routeLine: expect.objectContaining({
        memoryKey: "listened_to_route",
      }),
    });
  });
});
