import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  confirmAftersignPacketChoice,
  createAftersignVerticalSliceState,
  decodeAftersignDurableSave,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  openAftersignIoRecognitionBeat,
  recordAftersignPacketChoice,
  resolveAftersignPacketConfirmInteraction,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
  sampleAftersignIoRecognitionEnvelope,
  sampleAftersignPacketConfirmInteractionEnvelope,
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

  it("publishes the story/state snapshot that window.__game must expose", () => {
    const returningSession = meetIoForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(
          meetIoForAftersignSlice(
            recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
          ),
          3,
        ),
      ),
    );

    expect(
      getAftersignStoryState(returningSession, {
        playerId: "player-persistent-7",
        playerName: "Signal Runner",
        rememberedSessionIds: ["session-1"],
      }),
    ).toEqual({
      story: {
        id: "aftersign.verticalSlice",
        act: "act-1",
        beat: "io-remembers-opened-packet",
        completedBeats: [
          "packet-opened",
          "io-first-meeting",
          "io-remembers-opened-packet",
        ],
      },
      state: {
        scene: "io-return",
        player: {
          id: "player-persistent-7",
          name: "Signal Runner",
        },
        npcs: [
          {
            id: "io",
            name: "Io",
            disposition: "recognizes-player",
            rememberedSessionIds: ["session-1"],
            memory: {
              recognizesPlayer: true,
              packetOutcome: "opened",
            },
          },
        ],
      },
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

  it("publishes the live packet-choice confirm feel once the player commits a packet outcome", () => {
    const state = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );

    expect(confirmAftersignPacketChoice(state, 540)).toEqual({
      packetOutcome: "opened",
      confirmedAtMs: 540,
      confirmFeel: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
    });
  });

  it("rejects packet-choice confirm beats before the outcome is committed", () => {
    expect(() =>
      confirmAftersignPacketChoice(createAftersignVerticalSliceState(), 0),
    ).toThrow("Cannot confirm Aftersign packet choice: packetOutcome is not committed");

    const state = recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed");

    expect(() => confirmAftersignPacketChoice(state, -1)).toThrow(
      "Cannot confirm Aftersign packet choice: confirmedAtMs must be a non-negative finite number",
    );
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

  it("resolves the packet-confirm interaction kind from the committed outcome", () => {
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );

    expect(resolveAftersignPacketConfirmInteraction(opened)).toEqual({
      kind: "packetOpen",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen,
    });
    expect(resolveAftersignPacketConfirmInteraction(sealed)).toEqual({
      kind: "packetPreserve",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve,
    });
    expect(
      resolveAftersignPacketConfirmInteraction(sealed, "inspect"),
    ).toEqual({
      kind: "packetInspect",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect,
    });

    expect(() =>
      resolveAftersignPacketConfirmInteraction(createAftersignVerticalSliceState()),
    ).toThrow(
      "Cannot resolve Aftersign packet-confirm interaction: packetOutcome is not committed",
    );
  });

  it("routes the resolved kind through the live envelope sampler", () => {
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(opened);

    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(kind, 0);
    expect(envelope.kind).toBe("packetOpen");
    expect(envelope.label).toBe("packet-open");
    if (envelope.kind === "packetOpen") {
      expect(envelope.tearProgress).toBe(0);
    }
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
