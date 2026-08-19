import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
  resolveAftersignRememberingNpcDialogue,
} from "./verticalSliceRuntimeState";

const RECOGNITION_FEEL = AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL;

describe("AFTERSIGN remembering NPC recognition feel", () => {
  it("keeps first-contact dialogue quiet so the recognition beat only fires for returning memory", () => {
    const firstIoVisit = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const firstOrraVisit = meetOrraForAftersignSlice(
      recordAftersignOrraAction(firstIoVisit, "answered-saint-orra"),
    );

    expect(resolveAftersignRememberingNpcDialogue(firstIoVisit, "io")).toMatchObject({
      npc: "io",
      recognizesPlayer: false,
      recognitionFeel: null,
    });
    expect(resolveAftersignRememberingNpcDialogue(firstOrraVisit, "orra")).toMatchObject({
      npc: "orra",
      recognizesPlayer: false,
      recognitionFeel: null,
    });
  });

  it("hands Io's returning-memory beat a concrete, sampled feel envelope", () => {
    const firstVisit = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const returningVisit = meetIoForAftersignSlice(firstVisit);

    const dialogue = resolveAftersignRememberingNpcDialogue(returningVisit, "io");

    expect(dialogue).toMatchObject({
      npc: "io",
      recognizesPlayer: true,
      recognitionFeel: RECOGNITION_FEEL,
    });
    expect(dialogue.recognitionFeel).toEqual({
      preLineHoldMs: 120,
      portraitPushInPx: 14,
      portraitPushInMs: 260,
      portraitPushInEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
      recognitionRingDelayMs: 90,
      recognitionRingDurationMs: 420,
      recognitionRingScale: 1.18,
      recognitionRingOpacity: 0.72,
      subtitlePopDelayMs: 180,
      subtitlePopDistancePx: 8,
      subtitlePopMs: 220,
      subtitlePopEasing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      audioCueDelayMs: 120,
    });
  });

  it("shares the same feel envelope with Orra's returning-memory beat", () => {
    const firstIoVisit = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const firstOrraVisit = meetOrraForAftersignSlice(
      recordAftersignOrraAction(firstIoVisit, "answered-saint-orra"),
    );
    const returningOrraVisit = meetOrraForAftersignSlice(firstOrraVisit);

    expect(resolveAftersignRememberingNpcDialogue(returningOrraVisit, "orra")).toMatchObject({
      npc: "orra",
      recognizesPlayer: true,
      recognitionFeel: RECOGNITION_FEEL,
    });
  });
});
