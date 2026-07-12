import { describe, expect, it } from "vitest";

import {
  cancelPacketSealHold,
  createPacketSealState,
  DEFAULT_PACKET_SEAL_FEEL,
  samplePacketSealHold,
} from "./packetSealFeel";

describe("packet seal feel", () => {
  it("starts sealed with no visible strain or story commit", () => {
    expect(createPacketSealState()).toEqual({
      phase: "sealed",
      elapsedMs: 0,
      strainVisible: false,
      opened: false,
      storyCommitted: false,
    });
  });

  it("shows wax strain at 150ms without committing the story", () => {
    expect(samplePacketSealHold(DEFAULT_PACKET_SEAL_FEEL.strainVisibleMs)).toEqual({
      phase: "straining",
      elapsedMs: 150,
      strainVisible: true,
      opened: false,
      storyCommitted: false,
    });
  });

  it("commits opening and story on the same 720ms threshold frame", () => {
    expect(samplePacketSealHold(DEFAULT_PACKET_SEAL_FEEL.openThresholdMs)).toEqual({
      phase: "opened",
      elapsedMs: 720,
      strainVisible: true,
      opened: true,
      storyCommitted: true,
    });
  });

  it("cancels a short hold back to sealed before the story can commit", () => {
    const strained = samplePacketSealHold(320);

    expect(cancelPacketSealHold(strained)).toEqual(createPacketSealState());
  });

  it("does not rewind an opened packet on cancel", () => {
    const opened = samplePacketSealHold(900);

    expect(cancelPacketSealHold(opened)).toBe(opened);
  });

  it("clamps negative elapsed time so the harness cannot sample pre-input drift", () => {
    expect(samplePacketSealHold(-16)).toEqual(createPacketSealState());
  });
});
