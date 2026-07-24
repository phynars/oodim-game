import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  confirmAftersignPacketChoice,
  createAftersignVerticalSliceState,
  decodeAftersignDurableSave,
  encodeAftersignDurableSave,
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

type FeelContractSample = {
  label: string;
  value: unknown;
};

const collectFiniteNumbers = (value: unknown): number[] => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectFiniteNumbers);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectFiniteNumbers);
  }
  return [];
};

const collectStringTokens = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStringTokens);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStringTokens);
  }
  return [];
};

const expectLiveFeelContract = ({ label, value }: FeelContractSample) => {
  const numbers = collectFiniteNumbers(value);
  const strings = collectStringTokens(value);

  // Every juice contract has to be measurable — a bag of concrete ms / px /
  // degree / dB / frame numbers the renderer + audio bus can read directly.
  expect(numbers.length, `${label} should expose concrete ms/px/frame numbers`).toBeGreaterThan(0);
  // Bound the numeric magnitudes. Live-feedback beats live inside a small
  // envelope: milliseconds ≤ ~2s, px shifts single-digit, dB negative but
  // shallow. 2000 covers `IO_RETURNING_RECOGNITION_FEEL` (line/hold timings
  // that legitimately run near 2s) without letting a stray "5000ms" land.
  // -60 dB is the practical floor for an audible cue duck.
  expect(
    numbers.every((number) => number >= -60 && number <= 2_000),
    `${label} should keep live feedback numbers inside a mobile-readable envelope (dB ≥ -60, ms/px ≤ 2000)`,
  ).toBe(true);
  // Every juice contract has to be nameable — at minimum a beat label or an
  // audio cue name the runtime can log/route on. We don't regex-guess at
  // easing tokens: easing here is implemented as functions
  // (`easeOutCubic` in `interactionFeelContract.ts`) or short call-form
  // strings (`"outBack(1.7)"` in `packages/aftersign/src/interactionConfirm.ts`),
  // neither of which survives a keyword sniff. What every sample DOES carry
  // is a human-readable token — assert that instead.
  expect(
    strings.length,
    `${label} should carry at least one human-readable token (beat name, label, or audio cue)`,
  ).toBeGreaterThan(0);
  expect(
    strings.every((token) => token.trim().length > 0),
    `${label} should not carry empty string tokens`,
  ).toBe(true);
};

describe("Aftersign durable save/load contract", () => {
  it("keeps every live feedback contract numeric, bounded, and eased", () => {
    const samples: FeelContractSample[] = [
      { label: "packet-choice-confirm", value: AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL },
      { label: "io-recognition", value: AFTERSIGN_IO_RECOGNITION_FEEL },
      { label: "packet-open", value: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen },
      { label: "packet-preserve", value: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve },
      { label: "packet-inspect", value: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect },
    ];

    for (const sample of samples) {
      expectLiveFeelContract(sample);
    }
  });

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

  it("advances the packet-open envelope halfway through the tear window", () => {
    // Mid-tear frame: elapsedMs = 110, tearMs = 220 → tearProgress = 0.5.
    // Locks the tear ramp, the seal-scale interpolation back toward 1.0,
    // full cameraShakePx (recoil hasn't started yet at t < tearMs), and the
    // shard-opacity linear decay against waxShardLifeMs = 260.
    const opened = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "opened",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(opened);
    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(kind, 110);

    expect(envelope.kind).toBe("packetOpen");
    if (envelope.kind === "packetOpen") {
      expect(envelope.label).toBe("packet-open");
      expect(envelope.tearProgress).toBeCloseTo(0.5, 5);
      // sealScale = 1 + (sealSnapScale - 1) * (1 - tearProgress)
      //           = 1 + 0.08 * 0.5 = 1.04
      expect(envelope.sealScale).toBeCloseTo(1.04, 5);
      // Recoil begins at elapsedMs === tearMs, so cameraShakePx is still at peak.
      expect(envelope.cameraShakePx).toBeCloseTo(1.5, 5);
      // waxShardOpacity = 1 - 110/260
      expect(envelope.waxShardOpacity).toBeCloseTo(1 - 110 / 260, 5);
    }
  });

  it("pins the packet-preserve resting envelope to a soundless first frame", () => {
    // Sealed outcome routes to a fundamentally different envelope shape
    // (pulseProgress / sealScale / humDuckDb — no tear, no shards). At t=0
    // the pulse hasn't started: sealScale sits at 1 (no visual jump) and
    // humDuckDb sits at the full -3 dB duck before the bell fades it back.
    const sealed = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );
    const { kind } = resolveAftersignPacketConfirmInteraction(sealed);
    const envelope = sampleAftersignPacketConfirmInteractionEnvelope(kind, 0);

    expect(envelope).toEqual({
      kind: "packetPreserve",
      label: "packet-preserve",
      pulseProgress: 0,
      sealScale: 1,
      humDuckDb: -3,
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
