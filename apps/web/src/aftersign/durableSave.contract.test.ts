import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_IO_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  decodeAftersignDurableSave,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  openAftersignIoRecognitionBeat,
  recordAftersignPacketChoice,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
  sampleAftersignIoRecognitionEnvelope,
} from "./verticalSliceState";
import { sampleRecognitionFeedbackBeat } from "./recognitionFeedback";

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

  it("anchors Io's returning recognition envelope to the published cue timestamp", () => {
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const returningSession = meetIoForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(firstSession, 20)),
    );

    const { cue } = openAftersignIoRecognitionBeat(returningSession, 1_200);

    expect(cue).toEqual({
      kind: "io-recognition-beat",
      packetOutcome: "opened",
      startedAtMs: 1_200,
    });
    expect(
      sampleAftersignIoRecognitionEnvelope(cue, 1_320, {
        reducedMotion: true,
        lineId: "io-return-opened",
      }),
    ).toEqual(
      sampleRecognitionFeedbackBeat(120, {
        outcome: "opened",
        startedAt: 1_200,
        reducedMotion: true,
        lineId: "io-return-opened",
      }),
    );
  });

  it("rejects recognition cue opens before Io has a remembered packet outcome", () => {
    expect(() =>
      openAftersignIoRecognitionBeat(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        0,
      ),
    ).toThrow("Cannot open Io recognition beat: Io does not recognize the player yet");

    const returningWithoutPacket = meetIoForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(meetIoForAftersignSlice(createAftersignVerticalSliceState()), 4),
      ),
    );

    expect(() => openAftersignIoRecognitionBeat(returningWithoutPacket, 0)).toThrow(
      "Cannot open Io recognition beat: packetOutcome is not committed",
    );
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
