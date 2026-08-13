import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  sampleAftersignInteractionConfirmEnvelope,
  type AftersignInteractionConfirmEnvelope,
  type AftersignInteractionConfirmKind,
} from "./interactionFeelContract";
import {
  playAftersignConfirmFeel,
  type AftersignConfirmFeelHandle,
  type PlayAftersignConfirmFeelOptions,
} from "./aftersignConfirmFeel";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

export {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  type AftersignInteractionConfirmEnvelope,
  type AftersignInteractionConfirmKind,
};

export type AftersignPacketInteractionAction = "inspect" | "commit";

export type AftersignPacketConfirmInteraction = {
  kind: AftersignInteractionConfirmKind;
  feel: (typeof AFTERSIGN_INTERACTION_CONFIRM_FEEL)[AftersignInteractionConfirmKind];
};

export type AftersignPacketConfirmInteractionEffectsOptions = Omit<
  PlayAftersignConfirmFeelOptions,
  "label" | "feel"
> & {
  label?: string;
  reducedMotion?: boolean;
};

const PACKET_CONFIRM_LABELS: Record<AftersignInteractionConfirmKind, string> = {
  packetOpen: "Opened",
  packetPreserve: "Sealed",
  packetInspect: "Inspecting",
};

const PACKET_CONFIRM_BLOOM_OVERRIDES: Record<
  AftersignInteractionConfirmKind,
  Partial<PlayAftersignConfirmFeelOptions["feel"]>
> = {
  packetOpen: {
    durationMs: 460,
    pulseMs: 170,
    liftPx: 12,
    bloomOpacity: 0.82,
    ringScaleStart: 0.76,
    ringScaleEnd: 1.48,
    shakePx: 3.5,
  },
  packetPreserve: {
    durationMs: 520,
    pulseMs: 210,
    liftPx: 9,
    bloomOpacity: 0.72,
    ringScaleStart: 0.84,
    ringScaleEnd: 1.34,
    shakePx: 1.25,
  },
  packetInspect: {
    durationMs: 320,
    pulseMs: 130,
    liftPx: 5,
    bloomOpacity: 0.46,
    ringScaleStart: 0.94,
    ringScaleEnd: 1.16,
    shakePx: 0.75,
  },
};

function getPacketConfirmBloomFeel(
  kind: AftersignInteractionConfirmKind,
  reducedMotion: boolean,
): Partial<PlayAftersignConfirmFeelOptions["feel"]> {
  const feel = PACKET_CONFIRM_BLOOM_OVERRIDES[kind];

  if (!reducedMotion) return feel;

  return {
    ...feel,
    liftPx: 0,
    shakePx: 0,
    ringScaleStart: 1,
    ringScaleEnd: 1,
  };
}

export function resolveAftersignPacketConfirmInteraction(
  state: AftersignVerticalSliceState,
  action: AftersignPacketInteractionAction = "commit",
): AftersignPacketConfirmInteraction {
  if (action === "inspect") {
    return {
      kind: "packetInspect",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetInspect,
    };
  }

  if (state.packetOutcome === "opened") {
    return {
      kind: "packetOpen",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetOpen,
    };
  }
  if (state.packetOutcome === "sealed") {
    return {
      kind: "packetPreserve",
      feel: AFTERSIGN_INTERACTION_CONFIRM_FEEL.packetPreserve,
    };
  }

  throw new Error(
    "Cannot resolve Aftersign packet-confirm interaction: packetOutcome is not committed",
  );
}

export function playAftersignPacketConfirmInteractionFeel(
  interaction: AftersignPacketConfirmInteraction,
  options: AftersignPacketConfirmInteractionEffectsOptions = {},
): AftersignConfirmFeelHandle | null {
  const { label, reducedMotion = false, ...playOptions } = options;

  return playAftersignConfirmFeel({
    ...playOptions,
    label: label ?? PACKET_CONFIRM_LABELS[interaction.kind],
    feel: getPacketConfirmBloomFeel(interaction.kind, reducedMotion),
  });
}

export function resolveAndPlayAftersignPacketConfirmInteraction(
  state: AftersignVerticalSliceState,
  action: AftersignPacketInteractionAction = "commit",
  options: AftersignPacketConfirmInteractionEffectsOptions = {},
): AftersignPacketConfirmInteraction {
  const interaction = resolveAftersignPacketConfirmInteraction(state, action);
  playAftersignPacketConfirmInteractionFeel(interaction, options);
  return interaction;
}

export function sampleAftersignPacketConfirmInteractionEnvelope(
  kind: AftersignInteractionConfirmKind,
  elapsedMs: number,
  reducedMotion = false,
): AftersignInteractionConfirmEnvelope {
  return sampleAftersignInteractionConfirmEnvelope(kind, elapsedMs, reducedMotion);
}
