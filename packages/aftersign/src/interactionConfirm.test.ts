import { describe, expect, it } from "vitest";

import {
  assertDeliverPacketConfirmCue,
  createInteractionConfirmState,
  DELIVER_PACKET_CONFIRM_FEEL,
  playDeliverPacketConfirm,
  type InteractionConfirmState,
} from "./interactionConfirm.ts";

function cloneState(state: InteractionConfirmState): InteractionConfirmState {
  return {
    ...state,
    cueHistory: [...state.cueHistory],
  };
}

describe("playDeliverPacketConfirm", () => {
  it("publishes the deliver-packet confirmation cue synchronously", () => {
    const state = createInteractionConfirmState();
    const before = cloneState(state);
    const startedAtMs = 4200;

    const cue = playDeliverPacketConfirm(state, startedAtMs);

    assertDeliverPacketConfirmCue(before, state, cue, startedAtMs);
    expect(cue.kind).toBe("deliver-packet-confirm");
    expect(cue.lastCue).toBe("deliver-packet-confirm");
    expect(cue.lastCueAt).toBe(startedAtMs);
    expect(state.lastCue).toBe("deliver-packet-confirm");
    expect(state.lastCueAt).toBe(startedAtMs);
    expect(state.statePublishVersion).toBe(before.statePublishVersion + 1);
    expect(state.cueHistory).toEqual([cue]);
  });

  it("keeps the confirmation feel numbers in one exported contract", () => {
    const state = createInteractionConfirmState();

    const cue = playDeliverPacketConfirm(state, 5100);

    expect(cue.maxDriftMs).toBe(DELIVER_PACKET_CONFIRM_FEEL.maxDriftMs);
    expect(cue.pulseMs).toBe(DELIVER_PACKET_CONFIRM_FEEL.pulseMs);
    expect(cue.ringScaleFrom).toBe(DELIVER_PACKET_CONFIRM_FEEL.ringScaleFrom);
    expect(cue.ringScaleTo).toBe(DELIVER_PACKET_CONFIRM_FEEL.ringScaleTo);
    expect(cue.ringEase).toBe(DELIVER_PACKET_CONFIRM_FEEL.ringEase);
    expect(cue.phoneYawDegrees).toBe(DELIVER_PACKET_CONFIRM_FEEL.phoneYawDegrees);
    expect(cue.phoneLiftPx).toBe(DELIVER_PACKET_CONFIRM_FEEL.phoneLiftPx);
    expect(cue.shakePx).toBe(DELIVER_PACKET_CONFIRM_FEEL.shakePx);
    expect(cue.audioLeadMs).toBe(DELIVER_PACKET_CONFIRM_FEEL.audioLeadMs);
  });

  it("retains only the latest eight confirmation cues", () => {
    const state = createInteractionConfirmState();

    for (let index = 0; index < 10; index += 1) {
      playDeliverPacketConfirm(state, 6000 + index);
    }

    expect(state.cueHistory).toHaveLength(8);
    expect(state.cueHistory[0]?.lastCueAt).toBe(6002);
    expect(state.cueHistory[7]?.lastCueAt).toBe(6009);
    expect(state.statePublishVersion).toBe(10);
  });
});
