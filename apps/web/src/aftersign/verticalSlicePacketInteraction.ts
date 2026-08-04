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
    feel: reducedMotion ? { shakePx: 0 } : undefined,
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
