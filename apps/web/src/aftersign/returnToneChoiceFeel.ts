// AFTERSIGN — return-tone choice feel (per-posture press envelope).
//
// This is the strictly-visual + audio feel table for the RETURN-TONE
// choice the player strikes when Io asks "why did you come back?"
// (the third axis on the return beat, per `ioVoiceContract.ts`). One
// posture per row: `kind` / `evasive` / `blunt` — the same three-value
// axis as `AftersignReturnReason`, deliberately re-typed as an alias
// so the FEEL and the VOICE contract can never drift apart.
//
// SPLIT (sibling discipline — see `aftersignConfirmFeel.ts`):
//   1. `AFTERSIGN_RETURN_TONE_CHOICE_FEEL` + `getAftersignReturnToneChoiceFeel`
//      — pure data, one row per posture with the 13 numbers the CSS /
//      audio layer needs. Pinned by `returnToneChoiceFeel.contract.test.ts`.
//   2. `applyAftersignReturnToneChoiceFeel(element, choice)` — DOM
//      writer that stamps the row onto CSS variables + a dataset flag.
//      Wired into `harness/bootWindowGame.ts`'s `setIoReturnReason`
//      seam: when the harness records a posture and the served surface
//      exposes a `[data-aftersign-return-surface]` element, the feel
//      lands there. Covered by `returnToneChoiceFeel.consumer.test.ts`.
//
// Numbers per posture (13 pins each):
//   pressMs · liftPx · settleMs · easing · haloScale · haloFadeMs ·
//   shakePx · audioCue.frequencyHz · audioCue.attackMs ·
//   audioCue.releaseMs · audioCue.gain · choice · label
// The contract test freezes every one — no silent drift on "just a
// tiny tweak" PRs.
//
// WHY THE POSTURE TOKENS ARE `kind|evasive|blunt`, NOT `gentle|urgent|
// defiant`: the return-reason axis is already named in the shipped
// voice contract (`ioVoiceContract.ts::AftersignReturnReason`) and the
// harness (`bootWindowGame.ts::setIoReturnReason`). Keeping ONE token
// set across voice + feel means a caller can pass the same string to
// both surfaces without a translation layer — that mapping IS the
// coupling this module exists to provide.

import type { AftersignReturnReason } from "./ioVoiceContract";

export type AftersignReturnToneChoice = AftersignReturnReason;

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
> = Object.freeze({
  kind: Object.freeze({
    choice: "kind",
    label: "Kind return",
    pressMs: 72,
    liftPx: 5,
    settleMs: 190,
    easing: "cubic-bezier(0.2, 0.9, 0.18, 1)",
    haloScale: 1.08,
    haloFadeMs: 260,
    shakePx: 0,
    audioCue: Object.freeze({
      frequencyHz: 392,
      attackMs: 8,
      releaseMs: 180,
      gain: 0.055,
    }),
  }),
  evasive: Object.freeze({
    choice: "evasive",
    label: "Evasive return",
    pressMs: 58,
    liftPx: 8,
    settleMs: 150,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    haloScale: 1.14,
    haloFadeMs: 210,
    shakePx: 1.5,
    audioCue: Object.freeze({
      frequencyHz: 523,
      attackMs: 5,
      releaseMs: 130,
      gain: 0.07,
    }),
  }),
  blunt: Object.freeze({
    choice: "blunt",
    label: "Blunt return",
    pressMs: 84,
    liftPx: 3,
    settleMs: 230,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    haloScale: 1.2,
    haloFadeMs: 320,
    shakePx: 2,
    audioCue: Object.freeze({
      frequencyHz: 311,
      attackMs: 12,
      releaseMs: 220,
      gain: 0.06,
    }),
  }),
});

export function getAftersignReturnToneChoiceFeel(
  choice: AftersignReturnToneChoice,
): AftersignReturnToneChoiceFeel {
  return AFTERSIGN_RETURN_TONE_CHOICE_FEEL[choice];
}

/**
 * Stamp the return-tone feel for `choice` onto `element` as a set of
 * CSS custom properties + a dataset marker. Returns the row that was
 * applied so callers can chain (e.g. schedule an audio cue) without a
 * second table lookup.
 *
 * CSS variables written (all values include their unit suffix so the
 * consuming stylesheet can drop them into `transition` / `animation`
 * shorthands verbatim):
 *   --aftersign-return-press-ms       e.g. "72ms"
 *   --aftersign-return-lift-px        e.g. "5px"
 *   --aftersign-return-settle-ms      e.g. "190ms"
 *   --aftersign-return-easing         e.g. "cubic-bezier(0.2, 0.9, 0.18, 1)"
 *   --aftersign-return-halo-scale     e.g. "1.08"
 *   --aftersign-return-halo-fade-ms   e.g. "260ms"
 *   --aftersign-return-shake-px       e.g. "0px"
 *   --aftersign-return-tone-hz        e.g. "392"
 *   --aftersign-return-tone-attack-ms e.g. "8ms"
 *   --aftersign-return-tone-release-ms e.g. "180ms"
 *   --aftersign-return-tone-gain      e.g. "0.055"
 *
 * Dataset:
 *   element.dataset.aftersignReturnTone === choice
 */
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

/**
 * Selector the harness uses to find the return-tone surface in the
 * live DOM. Exported so consumer tests and the eventual scene renderer
 * pin the same string — no ad-hoc query strings drifting between the
 * writer and the readers.
 */
export const AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR =
  "[data-aftersign-return-surface]";
