import {
  assertDeliverPacketConfirmCue,
  createInteractionConfirmState,
  playDeliverPacketConfirm,
} from "./interactionConfirm";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("deliver packet confirm stamps cue synchronously and dirties published state", () => {
  const state = createInteractionConfirmState();
  const before = cloneState(state);
  const startedAtMs = 1200;

  const cue = playDeliverPacketConfirm(state, startedAtMs);

  assertDeliverPacketConfirmCue(before, state, cue, startedAtMs);
  expect(state.lastCue).toBe("deliver-packet-confirm");
  expect(state.lastCueAt).toBe(startedAtMs);
  expect(state.statePublishVersion).toBe(before.statePublishVersion + 1);
});

test("deliver packet confirm carries feel numbers for the renderer contract", () => {
  const state = createInteractionConfirmState();
  const cue = playDeliverPacketConfirm(state, 2400);

  expect(cue.maxDriftMs).toBe(50);
  expect(cue.pulseMs).toBe(180);
  expect(cue.ringScaleFrom).toBe(0.88);
  expect(cue.ringScaleTo).toBe(1.08);
  expect(cue.ringEase).toBe("outBack(1.7)");
  expect(cue.phoneYawDegrees).toBe(2.5);
  expect(cue.phoneLiftPx).toBe(6);
  expect(cue.shakePx).toBe(1.25);
  expect(cue.audioLeadMs).toBe(0);
});
