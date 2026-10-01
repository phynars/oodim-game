import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceSave,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignVerticalSliceState,
  sampleAftersignIoMemoryBeat,
} from "./verticalSliceState";

describe("verticalSliceState", () => {
  it("starts the slice at the kiosk before the player chooses the packet outcome", () => {
    expect(createAftersignVerticalSliceState()).toEqual({
      scene: "kiosk",
      packetOutcome: null,
      ioHasMetPlayer: false,
      ioRecognizesPlayer: false,
      orraHasMetPlayer: false,
      orraRecognizesPlayer: false,
      orraAction: null,
      hasChosenReturnTone: false,
      hasAskedForNextJob: false,
      rememberedTone: undefined,
    });
  });

  it("records the sealed packet choice without moving scenes", () => {
    const state = createAftersignVerticalSliceState();

    expect(recordAftersignPacketChoice(state, "sealed")).toMatchObject({
      scene: "kiosk",
      packetOutcome: "sealed",
      ioHasMetPlayer: false,
      ioRecognizesPlayer: false,
    });
  });

  it("does not make Io recognize the player on the first meeting", () => {
    const state = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );

    expect(meetIoForAftersignSlice(state)).toMatchObject({
      scene: "io-return",
      packetOutcome: "opened",
      ioHasMetPlayer: true,
      ioRecognizesPlayer: false,
    });
  });

  it("restores the remembered first meeting so Io recognizes the player next time", () => {
    const firstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const restored = restoreAftersignVerticalSliceState(
      createAftersignVerticalSliceSave(firstMeeting),
    );

    expect(meetIoForAftersignSlice(restored)).toMatchObject({
      scene: "io-return",
      packetOutcome: "sealed",
      ioHasMetPlayer: true,
      ioRecognizesPlayer: true,
    });
  });

  it("samples Io's memory beat for the harness", () => {
    const returned = meetIoForAftersignSlice(
      restoreAftersignVerticalSliceState({
        version: 1,
        packetOutcome: "opened",
        ioHasMetPlayer: true,
      }),
    );

    expect(sampleAftersignIoMemoryBeat(returned)).toEqual({
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "opened",
      recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
    });
  });
});
