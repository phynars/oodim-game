import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_KIOSK_SCENE_FEEL,
  AFTERSIGN_ORRA_RECOGNITION_FEEL,
  AFTERSIGN_PACKET_CHOICE_CONFIRM_FEEL,
  confirmAftersignPacketChoice,
  createAftersignVerticalSliceState,
  decodeAftersignDurableSave,
  encodeAftersignDurableSave,
  getAftersignStoryState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  openAftersignIoRecognitionBeat,
  openAftersignOrraRecognitionBeat,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  resolveAftersignPacketConfirmInteraction,
  restoreAftersignDurableSave,
  sampleAftersignIoMemoryBeat,
  sampleAftersignIoRecognitionEnvelope,
  sampleAftersignKioskSceneEnvelope,
  sampleAftersignOrraMemoryBeat,
  sampleAftersignOrraRecognitionEnvelope,
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
      { label: "orra-recognition", value: AFTERSIGN_ORRA_RECOGNITION_FEEL },
      { label: "kiosk-scene-ready", value: AFTERSIGN_KIOSK_SCENE_FEEL },
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

  it("round-trips Orra's own recognition memory without contaminating Io", () => {
    const firstSession = meetOrraForAftersignSlice(
      recordAftersignOrraAction(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        "answered-saint-orra",
      ),
    );

    const payload = encodeAftersignDurableSave(firstSession, 9);
    const envelope = decodeAftersignDurableSave(payload);
    const secondSession = meetOrraForAftersignSlice(restoreAftersignDurableSave(payload));

    expect(envelope).toEqual({
      key: "aftersign.verticalSlice.v1",
      savedAtTurn: 9,
      state: {
        version: 1,
        packetOutcome: "sealed",
        ioHasMetPlayer: true,
        orraHasMetPlayer: true,
        orraAction: "answered-saint-orra",
      },
    });
    expect(sampleAftersignIoMemoryBeat(secondSession)).toEqual({
      scene: "orra-return",
      recognizesPlayer: false,
      packetOutcome: "sealed",
      recognitionFeel: null,
    });
    expect(sampleAftersignOrraMemoryBeat(secondSession)).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "answered-saint-orra",
      recognitionFeel: AFTERSIGN_ORRA_RECOGNITION_FEEL,
    });
  });

  it("publishes the story/state snapshot after a durable NPC-memory round-trip", () => {
    // Session 1: choose "opened", meet Io, durably save. Session 2:
    // restore + meet Io again — the recognition state must project to
    // main's window-surface vocabulary (windowGameSurface.ts): beat
    // "io-remembers-opened-packet", Io disposition "recognizes-player",
    // and the remembered packet outcome surfaced in Io's memory block.
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
      rememberedSessionIds: ["session-1"],
    });

    expect(snapshot).toEqual({
      story: {
        id: "aftersign.verticalSlice",
        act: "act-1",
        beat: "io-remembers-opened-packet",
        completedBeats: ["packet-opened", "io-first-meeting", "io-remembers-opened-packet"],
        ioMemoryBeat: {
          scene: "io-return",
          recognizesPlayer: true,
          packetOutcome: "opened",
          recognitionFeel: AFTERSIGN_IO_RECOGNITION_FEEL,
        },
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

    // Pure-data rule: the snapshot must survive a JSON round-trip
    // byte-identical (no functions, cycles, or Dates).
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("publishes Orra's story memory beat alongside Io without sharing fields", () => {
    const returningSession = meetOrraForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(
          meetOrraForAftersignSlice(
            recordAftersignOrraAction(
              meetIoForAftersignSlice(
                recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
              ),
              "answered-saint-orra",
            ),
          ),
          13,
        ),
      ),
    );

    const snapshot = getAftersignStoryState(returningSession, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
      rememberedSessionIds: ["session-1"],
    });

    expect(snapshot.story.completedBeats).toContain("io-remembers-opened-packet");
    expect(snapshot.story.completedBeats).toContain("orra-remembers-answered-saint-orra");
    expect(snapshot.state.npcs).toEqual([
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
      {
        id: "orra",
        name: "Saint Orra",
        disposition: "recognizes-player",
        rememberedSessionIds: ["session-1"],
        memory: {
          recognizesPlayer: true,
          orraAction: "answered-saint-orra",
        },
      },
    ]);
    expect(snapshot.story.orraMemoryBeat).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "answered-saint-orra",
      recognitionFeel: AFTERSIGN_ORRA_RECOGNITION_FEEL,
    });
    expect(snapshot.story.orraMemoryBeat).not.toEqual(snapshot.story.ioMemoryBeat);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps Io's disposition met-player and recognition off before a durable return", () => {
    const firstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );

    const snapshot = getAftersignStoryState(firstMeeting, {
      playerId: "player-persistent-7",
      playerName: "Signal Runner",
    });

    expect(snapshot.story.beat).toBe("io-first-meeting");
    expect(snapshot.story.completedBeats).toEqual(["packet-sealed", "io-first-meeting"]);
    expect(snapshot.state.npcs[0].disposition).toBe("met-player");
    expect(snapshot.state.npcs[0].rememberedSessionIds).toEqual([]);
    expect(snapshot.state.npcs[0].memory).toEqual({
      recognizesPlayer: false,
      packetOutcome: "sealed",
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

  it("keeps Orra's first meeting quiet, then plays her own recognition feel on return", () => {
    const firstMeeting = meetOrraForAftersignSlice(
      recordAftersignOrraAction(createAftersignVerticalSliceState(), "answered-saint-orra"),
    );

    expect(sampleAftersignOrraMemoryBeat(firstMeeting)).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: false,
      orraAction: "answered-saint-orra",
      recognitionFeel: null,
    });

    const returningMeeting = meetOrraForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(firstMeeting, 14)),
    );

    expect(sampleAftersignOrraMemoryBeat(returningMeeting)).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "answered-saint-orra",
      recognitionFeel: AFTERSIGN_ORRA_RECOGNITION_FEEL,
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

  it("samples the kiosk scene-ready beat with camera, recognition, and audio timing", () => {
    expect(sampleAftersignKioskSceneEnvelope(0)).toEqual({
      label: "kiosk-scene-ready",
      elapsedMs: 0,
      cameraYOffsetPx: 18,
      cameraPushInZPx: -24,
      scanlineYPx: 0,
      ledGlowAlpha: 0,
      faceplateGlowPx: 0,
      humDuckDb: -4,
      audioCue: null,
    });

    const midBeat = sampleAftersignKioskSceneEnvelope(150);

    expect(midBeat.cameraYOffsetPx).toBeGreaterThan(0);
    expect(midBeat.cameraYOffsetPx).toBeLessThan(18);
    expect(midBeat.scanlineYPx).toBeGreaterThan(0);
    expect(midBeat.scanlineYPx).toBeLessThanOrEqual(42);
    expect(midBeat.ledGlowAlpha).toBeGreaterThan(0.9);
    expect(midBeat.faceplateGlowPx).toBeGreaterThan(5);
    expect(midBeat.humDuckDb).toBeCloseTo(0, 5);
    expect(midBeat.audioCue).toBe("kiosk-ready-chime");

    expect(sampleAftersignKioskSceneEnvelope(150, { reducedMotion: true })).toEqual({
      ...midBeat,
      cameraYOffsetPx: 0,
      cameraPushInZPx: 0,
      scanlineYPx: 42,
    });
  });

  it("rejects malformed kiosk scene-ready timestamps", () => {
    expect(() => sampleAftersignKioskSceneEnvelope(-1)).toThrow(
      "Cannot sample Aftersign kiosk scene feel: elapsedMs must be a non-negative finite number",
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

  it("anchors Orra's returning recognition envelope to her own published cue timestamp", () => {
    const firstSession = meetOrraForAftersignSlice(
      recordAftersignOrraAction(createAftersignVerticalSliceState(), "answered-saint-orra"),
    );
    const returningSession = meetOrraForAftersignSlice(
      restoreAftersignDurableSave(encodeAftersignDurableSave(firstSession, 22)),
    );

    const { cue } = openAftersignOrraRecognitionBeat(returningSession, 1_260);

    expect(cue).toEqual({
      kind: "orra-recognition-beat",
      orraAction: "answered-saint-orra",
      startedAtMs: 1_260,
    });
    expect(sampleAftersignOrraRecognitionEnvelope(cue, 1_380, { reducedMotion: true })).toEqual({
      label: "orra-recognition",
      elapsedMs: 120,
      saintHaloPulsePx: 0,
      cameraKneelDeg: 0,
      memoryThreadGlowAlpha: 0.82,
      chapelHumDuckDb: -2,
      audioCue: "orra-recognition-bell",
    });
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

  it("rejects Orra recognition cue opens before Orra has remembered the player", () => {
    expect(() =>
      openAftersignOrraRecognitionBeat(
        recordAftersignOrraAction(createAftersignVerticalSliceState(), "answered-saint-orra"),
        0,
      ),
    ).toThrow("Cannot open Orra recognition beat: Orra does not recognize the player yet");

    const returningWithoutAction = meetOrraForAftersignSlice(
      restoreAftersignDurableSave(
        encodeAftersignDurableSave(meetOrraForAftersignSlice(createAftersignVerticalSliceState()), 6),
      ),
    );

    expect(() => openAftersignOrraRecognitionBeat(returningWithoutAction, 0)).toThrow(
      "Cannot open Orra recognition beat: Orra action is not committed",
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

  it("rejects malformed durable save timestamps instead of writing unordered snapshots", () => {
    const state = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );

    expect(() => encodeAftersignDurableSave(state, -1)).toThrow(
      "Cannot encode Aftersign durable save: savedAtTurn must be a non-negative safe integer",
    );
    expect(() => encodeAftersignDurableSave(state, 1.5)).toThrow(
      "Cannot encode Aftersign durable save: savedAtTurn must be a non-negative safe integer",
    );
    expect(() =>
      restoreAftersignDurableSave(
        JSON.stringify({
          key: "aftersign.verticalSlice.v1",
          savedAtTurn: -1,
          state: {
            version: 1,
            packetOutcome: "opened",
            ioHasMetPlayer: true,
          },
        }),
      ),
    ).toThrow("Invalid Aftersign durable save: savedAtTurn is malformed");
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
