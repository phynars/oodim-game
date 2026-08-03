import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  type AftersignIoMemoryBeat,
} from "./verticalSliceRecognitionBeat";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";

/**
 * Player-visible save/load contract.
 *
 * Companion to `windowGameSurface`'s live surface: this test asserts
 * that the JSON-serialisable `AftersignStoryStateSnapshot` published
 * by `createAftersignWindowGameSurface` is stable across a durable
 * round-trip AND that a re-derived surface across a "second session"
 * produces the expected recognition beat.
 *
 * The values pinned here (`packet-sealed`, `io-first-meeting`,
 * `io-remembers-sealed-packet`, the `AftersignIoMemoryBeat` shape) are
 * the REAL union members and REAL types from `windowGameSurface.ts` /
 * `verticalSliceRecognitionBeat.ts` — so a drift in either module
 * breaks this test. It intentionally does not mock the surface.
 */

const PLAYER = { playerId: "player-soren", playerName: "Soren" };

function snapshotOf(
  state: ReturnType<typeof createAftersignVerticalSliceState>,
): AftersignStoryStateSnapshot {
  return createAftersignWindowGameSurface(state, PLAYER).getStoryState();
}

describe("player-visible flagship save/load contract", () => {
  it("round-trips the story-state snapshot through JSON without shape drift", () => {
    let state = createAftersignVerticalSliceState();
    state = recordAftersignPacketChoice(state, "sealed");
    state = meetIoForAftersignSlice(state);

    const live = snapshotOf(state);
    const durable = JSON.parse(JSON.stringify(live)) as AftersignStoryStateSnapshot;

    // The durable envelope is a byte-for-byte JSON round-trip of the
    // player-visible surface — no bespoke serialiser between them.
    expect(durable).toEqual(live);

    // Real beat IDs, not fiction. A rename in `AftersignStoryBeatId`
    // breaks this line.
    expect(durable.story.beat).toBe("io-first-meeting");
    expect(durable.story.completedBeats).toEqual([
      "packet-sealed",
      "io-first-meeting",
    ]);

    // Player identity survives the round-trip.
    expect(durable.state.player).toEqual({
      id: "player-soren",
      name: "Soren",
    });

    // Io is present with the real disposition ladder from the surface.
    const io = durable.state.npcs.find((npc) => npc.id === "io");
    expect(io?.disposition).toBe("met-player");
    expect(io?.memory).toEqual({
      recognizesPlayer: false,
      packetOutcome: "sealed",
    });
  });

  it("second session recognises the player and publishes the recognition beat", () => {
    // Session 1: player seals the packet and meets Io.
    let state = createAftersignVerticalSliceState();
    state = recordAftersignPacketChoice(state, "sealed");
    state = meetIoForAftersignSlice(state);
    const firstSurface = snapshotOf(state);

    // Session 2: state is rehydrated with the durable flags from
    // session 1 (packet outcome + ioHasMetPlayer). Meeting Io again
    // flips `ioRecognizesPlayer` — that is the real trigger for the
    // `io-remembers-sealed-packet` beat in `windowGameSurface.ts`.
    const rehydrated = {
      ...createAftersignVerticalSliceState(),
      packetOutcome: firstSurface.state.npcs.find((npc) => npc.id === "io")
        ?.memory.packetOutcome ?? null,
      ioHasMetPlayer: true,
    };
    const secondState = meetIoForAftersignSlice(rehydrated);
    const secondSurface = snapshotOf(secondState);

    expect(secondSurface.story.beat).toBe("io-remembers-sealed-packet");
    expect(secondSurface.story.completedBeats).toContain(
      "io-remembers-sealed-packet",
    );

    // Real `AftersignIoMemoryBeat` shape — recognition-feel pinned to
    // the frozen live contract, not an ad-hoc mock.
    const expectedIoBeat: AftersignIoMemoryBeat = {
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "sealed",
      recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
    };
    expect(secondSurface.story.ioMemoryBeat).toEqual(expectedIoBeat);

    const io = secondSurface.state.npcs.find((npc) => npc.id === "io");
    expect(io?.disposition).toBe("recognizes-player");
    expect(io?.memory.recognizesPlayer).toBe(true);
  });
});
