// AFTERSIGN — flagship tap-confirm feel (per-commit press envelope).
//
// This is the visual + audio feel table for the moment a player's tap
// COMMITS a fork on the flagship — the tiny squash-release-glow that
// tells the finger "yes, you pressed something, and it counted". One
// row: the tap-confirm envelope is a single family (unlike return-tone
// choice, which is per-posture), because the physicality of the button
// press is the same whether the player is sealing a packet, striking a
// return-tone posture, or asking for the next job. What DIFFERS across
// those forks is the meaning (voice, story state) — the CONFIRM beat
// is invariant.
//
// SPLIT (sibling discipline — mirrors `returnToneChoiceFeel.ts`):
//   1. `FLAGSHIP_TAP_CONFIRM_FEEL` + `getFlagshipTapConfirmFeel()`
//      — pure data, the 9 numbers the CSS layer needs. Frozen so a
//      contract test (`tapConfirmFeel.contract.test.ts`, pending) can
//      pin every field.
//   2. `applyFlagshipTapConfirmFeel(element)` — DOM writer that stamps
//      the row onto CSS custom properties + a dataset marker. Called
//      by `harness/bootWindowGame.ts::input.choose` on the tap-choice
//      surface whose id matches the committed choice. Covered by
//      `tapConfirmFeel.consumer.test.ts`. The CSS half of the contract
//      is `aftersign/index.html`'s
//      `button[data-aftersign-tap-confirm="armed"]` rule (+ its
//      `:active` refinement and `aftersign-tap-confirm-shake` keyframes)
//      which consumes all 9 stamped variables — so a tuning edit here
//      re-times the shipped surface, not just a synthetic vitest node.
//      Reduced-motion is honored in the same stylesheet (the shake +
//      scale channels collapse; the marker + glow survive so the tap
//      still lands as a crisp acknowledgement).
//   3. `attachFlagshipTapConfirmListeners(element)` — imperative
//      helper that binds pointerdown/pointerup/pointercancel to
//      animate the press envelope INLINE (no CSS variables needed).
//      Fallback path for slice code that opts out of the CSS-driven
//      envelope on `[data-aftersign-tap-choice]` buttons; the served
//      page uses the CSS path (see rule above), so this helper is
//      unused on the shipped surface today and covered only by unit
//      tests. Returns a cleanup fn.
//
// Numbers (9 pins):
//   pressScale · releaseScale · pressMs · releaseMs · releaseEasing ·
//   glowPx · glowMs · shakePx · shakeMs
//
// WHY POINTERLEAVE IS NOT A RELEASE TRIGGER:
// pointerleave fires whenever the finger drags off the target — even
// while still pressed. Treating that as a release would collapse the
// press envelope mid-gesture, and the player would see the button
// "un-press" while their finger is still down. iOS Safari, Chrome
// Android, and Firefox all deliver a proper `pointerup` OR
// `pointercancel` when the gesture actually ends (finger lifted, or
// scroll steals the pointer), so those two events are sufficient.

/**
 * Selector the harness uses to find tap-choice surfaces in the live
 * DOM. Re-exported alias of the value from `tapChoiceFeel.ts` — kept
 * as a re-export so consumers of this module don't have to import
 * both files just to know where to stamp.
 */
export { AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR } from "./tapChoiceFeel";

export type AftersignTapConfirmFeel = {
  readonly pressScale: number;
  readonly releaseScale: number;
  readonly pressMs: number;
  readonly releaseMs: number;
  readonly releaseEasing: string;
  readonly glowPx: number;
  readonly glowMs: number;
  readonly shakePx: number;
  readonly shakeMs: number;
};

export const FLAGSHIP_TAP_CONFIRM_FEEL: AftersignTapConfirmFeel =
  Object.freeze({
    pressScale: 0.96,
    releaseScale: 1.0,
    pressMs: 72,
    releaseMs: 140,
    releaseEasing: "cubic-bezier(0.16, 1, 0.3, 1)",
    glowPx: 10,
    glowMs: 180,
    shakePx: 2,
    shakeMs: 90,
  });

export function getFlagshipTapConfirmFeel(): AftersignTapConfirmFeel {
  return FLAGSHIP_TAP_CONFIRM_FEEL;
}

/**
 * Stamp the flagship tap-confirm feel onto `element` as a set of CSS
 * custom properties + a dataset marker. Returns the row that was
 * applied so callers can chain (e.g. schedule an audio cue) without a
 * second table lookup.
 *
 * CSS variables written (values include their unit suffix so the
 * consuming stylesheet can drop them into `transition` shorthands
 * verbatim):
 *   --aftersign-tap-confirm-press-scale     e.g. "0.96"
 *   --aftersign-tap-confirm-release-scale   e.g. "1"
 *   --aftersign-tap-confirm-press-ms        e.g. "72ms"
 *   --aftersign-tap-confirm-release-ms      e.g. "140ms"
 *   --aftersign-tap-confirm-release-easing  e.g. "cubic-bezier(...)"
 *   --aftersign-tap-confirm-glow-px         e.g. "10px"
 *   --aftersign-tap-confirm-glow-ms         e.g. "180ms"
 *   --aftersign-tap-confirm-shake-px        e.g. "2px"
 *   --aftersign-tap-confirm-shake-ms        e.g. "90ms"
 *
 * Dataset:
 *   element.dataset.aftersignTapConfirm === "armed"
 */
export function applyFlagshipTapConfirmFeel(
  element: HTMLElement,
): AftersignTapConfirmFeel {
  const feel = FLAGSHIP_TAP_CONFIRM_FEEL;

  element.dataset.aftersignTapConfirm = "armed";
  element.style.setProperty(
    "--aftersign-tap-confirm-press-scale",
    `${feel.pressScale}`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-release-scale",
    `${feel.releaseScale}`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-press-ms",
    `${feel.pressMs}ms`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-release-ms",
    `${feel.releaseMs}ms`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-release-easing",
    feel.releaseEasing,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-glow-px",
    `${feel.glowPx}px`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-glow-ms",
    `${feel.glowMs}ms`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-shake-px",
    `${feel.shakePx}px`,
  );
  element.style.setProperty(
    "--aftersign-tap-confirm-shake-ms",
    `${feel.shakeMs}ms`,
  );

  return feel;
}

/**
 * Imperative helper: bind pointerdown / pointerup / pointercancel to
 * `element` so the press envelope plays inline via `element.style`
 * (no CSS variables required). Returns a cleanup function.
 *
 * Trigger set is deliberately limited to `pointerdown` + `pointerup`
 * + `pointercancel`. `pointerleave` is NOT bound — it fires when the
 * finger drags off the target mid-press, and treating that as a
 * release would collapse the envelope while the gesture is still
 * live. The browser fires a proper `pointerup` or `pointercancel`
 * when the gesture actually ends, so those two are sufficient.
 *
 * Respects `prefers-reduced-motion: reduce` — the transform stays at
 * `none` and only the glow animates.
 *
 * Returns a no-op cleanup when `element` is null/undefined, so callers
 * can `attachFlagshipTapConfirmListeners(document.querySelector(...))`
 * without a null guard.
 */
export function attachFlagshipTapConfirmListeners(
  element: HTMLElement | null | undefined,
): () => void {
  if (!element) return () => {};

  const win = (globalThis as { window?: Window }).window;
  const reduceMotion =
    typeof win !== "undefined" &&
    typeof win.matchMedia === "function" &&
    win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const feel = FLAGSHIP_TAP_CONFIRM_FEEL;
  let glowTimer: ReturnType<typeof setTimeout> | 0 = 0;

  const clearGlow = () => {
    if (glowTimer) {
      clearTimeout(glowTimer as ReturnType<typeof setTimeout>);
      glowTimer = 0;
    }
  };

  const press = (): void => {
    clearGlow();
    element.style.transition = `transform ${feel.pressMs}ms ease-out, box-shadow ${feel.glowMs}ms ease-out`;
    element.style.transform = reduceMotion
      ? "none"
      : `scale(${feel.pressScale})`;
    element.style.boxShadow = `0 0 ${feel.glowPx}px rgba(122, 231, 255, 0.56)`;
  };

  const release = (): void => {
    element.style.transition = `transform ${feel.releaseMs}ms ${feel.releaseEasing}, box-shadow ${feel.glowMs}ms ease-out`;
    element.style.transform = reduceMotion
      ? "none"
      : `scale(${feel.releaseScale})`;
    glowTimer = setTimeout(() => {
      element.style.boxShadow = "";
      glowTimer = 0;
    }, feel.glowMs);
  };

  element.addEventListener("pointerdown", press);
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  // Deliberately NOT bound: pointerleave. See the module header
  // "WHY POINTERLEAVE IS NOT A RELEASE TRIGGER".

  return () => {
    clearGlow();
    element.removeEventListener("pointerdown", press);
    element.removeEventListener("pointerup", release);
    element.removeEventListener("pointercancel", release);
  };
}
