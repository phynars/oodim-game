import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  decodeAftersignDurableSave,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
} from "./verticalSliceState";

describe("Aftersign durable save/load contract", () => {
  it("round-trips the remembered packet outcome through a durable save payload", () => {
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );

    const payload = encodeAftersignDurableSave(firstSession, 7);
    const envelope = decodeAftersignDurableSave(payload);
    const secondSession = meetIoForAftersignSlice(restoreAftersignDurableSave(payload));

    expect(envelope).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn: 7,
      state: {
        version: 1,
        packetOutcome: "sealed",
        ioHasMetPlayer: true,
      },
    });
    expect(sampleAftersignIoMemoryBeat(secondSession)).toEqual({
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "sealed",
      recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
    });
  });

  it("keeps Io's first meeting quiet, then plays the frozen recognition feel on return", () => {
    const unopenedFirstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );

    expect(sampleAftersignIoMemoryBeat(unopenedFirstMeeting)).toEqual({
      scene: "io-return",
      recognizesPlayer: false,
      packetOutcome: "sealed",
      recognitionFeel: null,
    });

    const savedAfterFirstMeeting = encodeAftersignDurableSave(unopenedFirstMeeting, 12);
    const returningMeeting = meetIoForAftersignSlice(
      restoreAftersignDurableSave(savedAfterFirstMeeting),
    );

    expect(sampleAftersignIoMemoryBeat(returningMeeting)).toEqual({
      scene: "io-return",
      recognizesPlayer: true,
      packetOutcome: "sealed",
      recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
    });
  });

  it("rejects malformed durable save payloads instead of silently resetting story state", () => {
    expect(() => restoreAftersignDurableSave("not-json")).toThrow(
      "Invalid Aftersign durable save: payload is not JSON",
    );
    expect(() =>
      restoreAftersignDurableSave(
        JSON.stringify({
          key: "aftersign.verticalSlice.v1",
          savedAtTurn: 8,
          state: {
            version: 1,
            packetOutcome: "forgotten",
            ioHasMetPlayer: true,
          },
        }),
      ),
    ).toThrow("Invalid Aftersign durable save: state is malformed");
  });
});
