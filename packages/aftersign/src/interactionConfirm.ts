export type InteractionCueKind = "deliver-packet-confirm";

export interface InteractionConfirmCue {
  kind: InteractionCueKind;
  lastCue: InteractionCueKind;
  lastCueAt: number;
  maxDriftMs: number;
  pulseMs: number;
  ringScaleFrom: number;
  ringScaleTo: number;
  ringEase: "outBack(1.7)";
  phoneYawDegrees: number;
  phoneLiftPx: number;
  shakePx: number;
  audioLeadMs: number;
}

export interface InteractionConfirmState {
  lastCue: InteractionCueKind | null;
  lastCueAt: number | null;
  cueHistory: InteractionConfirmCue[];
  statePublishVersion: number;
}

export const DELIVER_PACKET_CONFIRM_FEEL = {
  maxDriftMs: 50,
  pulseMs: 180,
  ringScaleFrom: 0.88,
  ringScaleTo: 1.08,
  ringEase: "outBack(1.7)" as const,
  phoneYawDegrees: 2.5,
  phoneLiftPx: 6,
  shakePx: 1.25,
  audioLeadMs: 0,
};

export function createInteractionConfirmState(): InteractionConfirmState {
  return {
    lastCue: null,
    lastCueAt: null,
    cueHistory: [],
    statePublishVersion: 0,
  };
}

export function playDeliverPacketConfirm(
  state: InteractionConfirmState,
  nowMs: number,
): InteractionConfirmCue {
  const cue: InteractionConfirmCue = {
    kind: "deliver-packet-confirm",
    lastCue: "deliver-packet-confirm",
    lastCueAt: nowMs,
    ...DELIVER_PACKET_CONFIRM_FEEL,
  };

  state.lastCue = cue.lastCue;
  state.lastCueAt = cue.lastCueAt;
  state.cueHistory = [...state.cueHistory, cue].slice(-8);
  state.statePublishVersion += 1;

  return cue;
}

export function assertDeliverPacketConfirmCue(
  before: InteractionConfirmState,
  after: InteractionConfirmState,
  cue: InteractionConfirmCue,
  startedAtMs: number,
): void {
  if (cue.kind !== "deliver-packet-confirm") {
    throw new Error(`expected deliver-packet-confirm cue, got ${cue.kind}`);
  }

  if (cue.lastCueAt !== startedAtMs || after.lastCueAt !== startedAtMs) {
    throw new Error("deliver packet confirm must stamp lastCueAt synchronously before async audio or story work");
  }

  if (cue.lastCueAt - startedAtMs > DELIVER_PACKET_CONFIRM_FEEL.maxDriftMs) {
    throw new Error(`deliver packet confirm drift exceeded ${DELIVER_PACKET_CONFIRM_FEEL.maxDriftMs}ms`);
  }

  if (after.lastCue !== "deliver-packet-confirm") {
    throw new Error("deliver packet confirm did not publish lastCue");
  }

  if (after.statePublishVersion <= before.statePublishVersion) {
    throw new Error("deliver packet confirm must dirty/publish state so __game sees the cue");
  }
}
