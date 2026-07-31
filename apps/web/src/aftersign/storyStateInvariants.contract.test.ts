import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

const assertJsonStable = (value: unknown) => {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value);
};

describe("Aftersign story/state invariant contract", () => {
  it("publishes one canonical current beat that is also listed as completed", () => {
    const state = meetIoForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(
          meetIoForAftersignSlice(
            recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
          ),
          41,
        ),
      ),
    );

    const snapshot = getAftersignStoryState(state, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-1"],
    });

    expect(snapshot.story.id).toBe("aftersign.verticalSlice");
    expect(snapshot.story.act).toBe("act-1");
    expect(snapshot.story.beat).toBe("io-remembers-opened-packet");
    expect(snapshot.story.completedBeats).toContain(snapshot.story.beat);
    expect(new Set(snapshot.story.completedBeats).size).toBe(snapshot.story.completedBeats.length);
    assertJsonStable(snapshot);
  });

  it("keeps the durable save pointer visible on the same state surface as the remembering NPC", () => {
    const savedAtTurn = 42;
    const state = meetIoForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(
          meetIoForAftersignSlice(
            recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
          ),
          savedAtTurn,
        ),
      ),
    );

    const snapshot = getAftersignStoryState(state, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-1"],
    });

    expect(snapshot.state.save).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn,
    });
    expect(snapshot.state.npcs).toEqual([
      {
        id: "io",
        name: "Io",
        disposition: "recognizes-player",
        rememberedSessionIds: ["session-1"],
        memory: {
          recognizesPlayer: true,
          packetOutcome: "sealed",
        },
      },
    ]);
    assertJsonStable(snapshot.state);
  });
});
