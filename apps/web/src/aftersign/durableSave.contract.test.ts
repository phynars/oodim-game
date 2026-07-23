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

  it("publishes the FlagshipGameSurface-shaped story/state snapshot after a durable NPC-memory round-trip", () => {
    // Session 1: choose "opened", meet Io, durably save. Session 2:
    // restore + meet Io again — the recognition state must project to
    // the AUTHORITATIVE contract vocabulary (e2e-shared/
    // flagshipStoryStateContract.ts): scene.act 'act-1-seal', beat
    // 'io-return-recognition', memory id from IO_RETURN_MEMORY_ID with
    // source 'server'. No invented enums.
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

    const snapshot = getAftersignStoryState(returningSession, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      sessionId: "session-1",
    });

    expect(snapshot).toEqual({
      version: 1,
      build: {
        slug: "aftersign",
        mode: "test",
      },
      scene: {
        id: "io-night-post-kiosk",
        act: "act-1-seal",
        beat: "io-return-recognition",
        ready: true,
      },
      player: {
        id: "player-persistent-7",
        name: "Signal Runner",
        flags: {
          io_intro_seen: true,
          returned_after_first_session: true,
        },
      },
      delivery: {
        id: "blue-packet",
        outcome: "opened",
      },
      npcs: {
        io: {
          id: "io",
          displayName: "Io Vale",
          present: true,
          trustPosture: "useful-breach",
          memories: [
            {
              id: "io-remembers-blue-packet-opened",
              kind: "delivery-outcome",
              subject: "player",
              predicate: "delivered-packet",
              object: "opened",
              deliveryId: "blue-packet",
              sessionId: "session-1",
              source: "server",
            },
          ],
          lastLine: null,
          lastLineMemoryRefs: [],
        },
      },
    });

    // Pure-data rule from the contract: the snapshot must survive a
    // JSON round-trip byte-identical (no functions, cycles, or Dates).
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps Io's memories empty and posture untested before recognition", () => {
    const firstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );

    const snapshot = getAftersignStoryState(firstMeeting, {
      playerId: "player-persistent-7",
      sessionId: "session-1",
    });

    expect(snapshot.scene.beat).toBe("packet-delivered");
    expect(snapshot.delivery.outcome).toBe("sealed");
    expect(snapshot.npcs.io.trustPosture).toBe("untested");
    expect(snapshot.npcs.io.memories).toEqual([]);
    expect(snapshot.player.name).toBeNull();
    expect(snapshot.player.flags).toEqual({ io_intro_seen: true });
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
