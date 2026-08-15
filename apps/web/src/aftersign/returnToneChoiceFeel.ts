export type AftersignReturnToneChoice = "gentle" | "urgent" | "defiant";

export type AftersignReturnToneChoiceFeel = {
  readonly choice: AftersignReturnToneChoice;
  readonly label: string;
  readonly pressMs: number;
  readonly liftPx: number;
  readonly settleMs: number;
  readonly easing: string;
  readonly haloScale: number;
  readonly haloFadeMs: number;
  readonly shakePx: number;
  readonly audioCue: {
    readonly frequencyHz: number;
    readonly attackMs: number;
    readonly releaseMs: number;
    readonly gain: number;
  };
};

export const AFTERSIGN_RETURN_TONE_CHOICE_FEEL: Record<
  AftersignReturnToneChoice,
  AftersignReturnToneChoiceFeel
> = {
  gentle: {
    choice: "gentle",
    label: "Gentle return",
    pressMs: 72,
    liftPx: 5,
    settleMs: 190,
    easing: "cubic-bezier(0.2, 0.9, 0.18, 1)",
    haloScale: 1.08,
    haloFadeMs: 260,
    shakePx: 0,
    audioCue: {
      frequencyHz: 392,
      attackMs: 8,
      releaseMs: 180,
      gain: 0.055,
    },
  },
  urgent: {
    choice: "urgent",
    label: "Urgent return",
    pressMs: 58,
    liftPx: 8,
    settleMs: 150,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    haloScale: 1.14,
    haloFadeMs: 210,
    shakePx: 1.5,
    audioCue: {
      frequencyHz: 523,
      attackMs: 5,
      releaseMs: 130,
      gain: 0.07,
    },
  },
  defiant: {
    choice: "defiant",
    label: "Defiant return",
    pressMs: 84,
    liftPx: 3,
    settleMs: 230,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    haloScale: 1.2,
    haloFadeMs: 320,
    shakePx: 2,
    audioCue: {
      frequencyHz: 311,
      attackMs: 12,
      releaseMs: 220,
      gain: 0.06,
    },
  },
};

export function getAftersignReturnToneChoiceFeel(
  choice: AftersignReturnToneChoice,
): AftersignReturnToneChoiceFeel {
  return AFTERSIGN_RETURN_TONE_CHOICE_FEEL[choice];
}

export function applyAftersignReturnToneChoiceFeel(
  element: HTMLElement,
  choice: AftersignReturnToneChoice,
): AftersignReturnToneChoiceFeel {
  const feel = getAftersignReturnToneChoiceFeel(choice);

  element.dataset.aftersignReturnTone = feel.choice;
  element.style.setProperty("--aftersign-return-press-ms", `${feel.pressMs}ms`);
  element.style.setProperty("--aftersign-return-lift-px", `${feel.liftPx}px`);
  element.style.setProperty("--aftersign-return-settle-ms", `${feel.settleMs}ms`);
  element.style.setProperty("--aftersign-return-easing", feel.easing);
  element.style.setProperty("--aftersign-return-halo-scale", `${feel.haloScale}`);
  element.style.setProperty("--aftersign-return-halo-fade-ms", `${feel.haloFadeMs}ms`);
  element.style.setProperty("--aftersign-return-shake-px", `${feel.shakePx}px`);
  element.style.setProperty("--aftersign-return-tone-hz", `${feel.audioCue.frequencyHz}`);
  element.style.setProperty("--aftersign-return-tone-attack-ms", `${feel.audioCue.attackMs}ms`);
  element.style.setProperty("--aftersign-return-tone-release-ms", `${feel.audioCue.releaseMs}ms`);
  element.style.setProperty("--aftersign-return-tone-gain", `${feel.audioCue.gain}`);

  return feel;
}
