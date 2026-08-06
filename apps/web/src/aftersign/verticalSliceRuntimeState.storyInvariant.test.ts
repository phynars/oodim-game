import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";

describe("Aftersign vertical-slice story/state invariants", () => {
  it("does not let an NPC recognize the player before a prior meeting exists", () => {
    const initialState = createAftersignVerticalSliceState();

    expect(initialState.ioHasMetPlayer).toBe(false);
    expect(initialState.ioRecognizesPlayer).toBe(false);
    expect(initialState.orraHasMetPlayer).toBe(false);
    expect(initialState.orraRecognizesPlayer).toBe(false);

    const firstIoReturn = meetIoForAftersignSlice(initialState);
    const firstOrraReturn = meetOrraForAftersignSlice(initialState);

    expect(firstIoReturn.scene).toBe("io-return");
    expect(firstIoReturn.ioHasMetPlayer).toBe(true);
    expect(firstIoReturn.ioRecognizesPlayer).toBe(false);
    expect(firstOrraReturn.scene).toBe("orra-return");
    expect(firstOrraReturn.orraHasMetPlayer).toBe(true);
    expect(firstOrraReturn.orraRecognizesPlayer).toBe(false);
  });

  it("recognizes the player only on a later return after the first meeting is recorded", () => {
    const afterFirstIoMeeting = meetIoForAftersignSlice(
      createAftersignVerticalSliceState(),
    );
    const afterSecondIoMeeting = meetIoForAftersignSlice(afterFirstIoMeeting);

    expect(afterSecondIoMeeting.scene).toBe("io-return");
    expect(afterSecondIoMeeting.ioHasMetPlayer).toBe(true);
    expect(afterSecondIoMeeting.ioRecognizesPlayer).toBe(true);

    const afterFirstOrraMeeting = meetOrraForAftersignSlice(
      createAftersignVerticalSliceState(),
    );
    const afterSecondOrraMeeting = meetOrraForAftersignSlice(
      afterFirstOrraMeeting,
    );

    expect(afterSecondOrraMeeting.scene).toBe("orra-return");
    expect(afterSecondOrraMeeting.orraHasMetPlayer).toBe(true);
    expect(afterSecondOrraMeeting.orraRecognizesPlayer).toBe(true);
  });

  it("keeps committed story choices when the scene advances", () => {
    const committedState = recordAftersignOrraAction(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
      "answered-saint-orra",
    );

    const advancedState = meetOrraForAftersignSlice(committedState);

    expect(advancedState.packetOutcome).toBe("sealed");
    expect(advancedState.orraAction).toBe("answered-saint-orra");
    expect(advancedState.scene).toBe("orra-return");
  });
});
