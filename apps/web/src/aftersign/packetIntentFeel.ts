export type AftersignPacketIntentKind = "preserve" | "open" | "inspect" | "cancel";

export interface AftersignPacketIntentFeel {
  readonly kind: AftersignPacketIntentKind;
  readonly durationMs: number;
  readonly scaleFrom: number;
  readonly scaleTo: number;
  readonly yPx: number;
  readonly glowOpacity: number;
  readonly ringPx: number;
  readonly cameraShakePx: number;
  readonly audioGainDb: number;
  readonly easing: "easeOutCubic" | "easeOutBack" | "easeInOutCubic";
}

export interface AftersignPacketHoldState {
  readonly elapsedMs: number;
  readonly thresholdMs: number;
  readonly progress: number;
  readonly committed: boolean;
  readonly affordance: AftersignPacketIntentFeel;
}

export const AFTERSIGN_PACKET_INTENT_HOLD_THRESHOLD_MS = 420;

export const AFTERSIGN_PACKET_INTENT_FEEL: Readonly<Record<AftersignPacketIntentKind, AftersignPacketIntentFeel>> = {
  preserve: {
    kind: "preserve",
    durationMs: 180,
    scaleFrom: 1,
    scaleTo: 0.985,
    yPx: -2,
    glowOpacity: 0.34,
    ringPx: 3,
    cameraShakePx: 0,
    audioGainDb: -18,
    easing: "easeOutCubic",
  },
  open: {
    kind: "open",
    durationMs: 260,
    scaleFrom: 0.985,
    scaleTo: 1.045,
    yPx: -8,
    glowOpacity: 0.72,
    ringPx: 9,
    cameraShakePx: 1.5,
    audioGainDb: -12,
    easing: "easeOutBack",
  },
  inspect: {
    kind: "inspect",
    durationMs: 220,
    scaleFrom: 1,
    scaleTo: 1.02,
    yPx: -4,
    glowOpacity: 0.52,
    ringPx: 6,
    cameraShakePx: 0.5,
    audioGainDb: -15,
    easing: "easeInOutCubic",
  },
  cancel: {
    kind: "cancel",
    durationMs: 140,
    scaleFrom: 1.02,
    scaleTo: 1,
    yPx: 0,
    glowOpacity: 0.18,
    ringPx: 1,
    cameraShakePx: 0,
    audioGainDb: -24,
    easing: "easeOutCubic",
  },
};

export function resolveAftersignPacketTapIntent(heldMs: number): AftersignPacketIntentKind {
  return heldMs >= AFTERSIGN_PACKET_INTENT_HOLD_THRESHOLD_MS ? "open" : "preserve";
}

export function sampleAftersignPacketHoldState(heldMs: number): AftersignPacketHoldState {
  const elapsedMs = Math.max(0, heldMs);
  const progress = Math.min(1, elapsedMs / AFTERSIGN_PACKET_INTENT_HOLD_THRESHOLD_MS);
  const committed = progress >= 1;

  return {
    elapsedMs,
    thresholdMs: AFTERSIGN_PACKET_INTENT_HOLD_THRESHOLD_MS,
    progress,
    committed,
    affordance: committed ? AFTERSIGN_PACKET_INTENT_FEEL.open : AFTERSIGN_PACKET_INTENT_FEEL.inspect,
  };
}

export function resolveAftersignPacketReleaseIntent(heldMs: number, cancelled: boolean): AftersignPacketIntentFeel {
  if (cancelled) {
    return AFTERSIGN_PACKET_INTENT_FEEL.cancel;
  }

  return AFTERSIGN_PACKET_INTENT_FEEL[resolveAftersignPacketTapIntent(heldMs)];
}
