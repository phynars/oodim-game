import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  createAftersignWindowGameSurface,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
} from "./verticalSliceState";

// The sibling `durableSave.contract.test.ts` already asserts that a
// durably-restored state, when passed directly to `getAftersignStoryState`,
// publishes `state.save.savedAtTurn`. This file covers the adjacent
// `window.__game` contracts that were still uncovered:
//
//   1. Fresh (never-saved) states OMIT `state.save` entirely — the
//      surface must not fabricate a save envelope for an in-memory
//      session that has no `savedAtTurn`.
//   2. The `savedAtTurn` value flows through the CONSTRUCTOR path —
//      `createAftersignWindowGameSurface(state, options).getStoryState()`
//      — not just the direct `getAftersignStoryState(state, options)`
//      call the sibling test exercises. Both entry points share a body
//      today; this pins the constructor path so a refactor that drifts
//      one from the other is caught.
//   3. Save metadata survives later story progression on the restored
//      session. A loaded session can advance before the next durable write;
//      the public surface should still report the last known durable turn.
describe("AFTERSIGN durable save surface — window.__game omissions and flow", () => {
  it("omits state.save on a fresh in-memory session (never durably saved)", () => {
    const fresh = createAftersignVerticalSliceState();

    const snapshot = createAftersignWindowGameSurface(fresh, {
      playerId: "player-fresh-1",
      playerName: "Signal Runner",
    }).getStoryState();

    expect(snapshot.state).not.toHaveProperty("save");
    // The whole snapshot must still be JSON-clean — no functions leaked
    // into the shape by the omission branch.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("surfaces savedAtTurn through createAftersignWindowGameSurface().getStoryState()", () => {
    const savedAtTurn = 31;
    const restoredSession = meetIoForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(
          meetIoForAftersignSlice(
            recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
          ),
          savedAtTurn,
        ),
      ),
    );

    const snapshot = createAftersignWindowGameSurface(restoredSession, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-1"],
    }).getStoryState();

    expect(snapshot.state.save).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn,
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps the last durable save turn visible after restored story progression", () => {
    const savedAtTurn = 31;
    const restoredThenAdvanced = meetOrraForAftersignSlice(
      meetIoForAftersignSlice(
        restoreAftersignDurableSave(
          encodeAftersignDurableSave(
            meetIoForAftersignSlice(
              recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
            ),
            savedAtTurn,
          ),
        ),
      ),
    );

    const snapshot = createAftersignWindowGameSurface(restoredThenAdvanced, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-1"],
    }).getStoryState();

    expect(snapshot.state.save).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn,
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
