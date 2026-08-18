// Consumer test for the flagship tap-confirm feel wiring.
//
// `bootAftersignWindowGame` is the runtime consumer of
// `applyFlagshipTapConfirmFeel` — this jsdom test drives the harness's
// `input.choose(...)` seam and asserts:
//   1. Every committing choice records the applied feel row on
//      `getAppliedTapConfirmFeel()` (ground truth, DOM-optional).
//   2. When the caller mounts a `[data-aftersign-tap-choice="<id>"]`
//      element, `input.choose("<id>")` stamps the 9 CSS variables +
//      dataset marker on that specific element — NOT on every
//      tap-choice surface in the tray.
//   3. `attachFlagshipTapConfirmListeners` does NOT release the press
//      envelope when the finger drags off the target — pointerleave
//      is not a release trigger (see the module header).
//
// Scope guard:
//   - does NOT touch the ms/px numbers in
//     FLAGSHIP_TAP_CONFIRM_FEEL beyond one sanity sample per axis
//     — the 9-field freeze is a follow-up contract test.
//   - does NOT re-derive story state; the harness's beat progression
//     is covered by windowGameHarnessBoot.test.ts.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  attachFlagshipTapConfirmListeners,
  FLAGSHIP_TAP_CONFIRM_FEEL,
} from "./tapConfirmFeel";
import { AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR } from "./tapChoiceFeel";
import { AFTERSIGN_ASK_FOR_NEXT_JOB } from "./issue1199ChoiceHandlers";
import "./harness/bootWindowGame";

function mountTapChoice(choiceId: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("data-aftersign-tap-choice", choiceId);
  document.body.append(el);
  return el;
}

const cssVar = (el: HTMLElement, name: string): string =>
  // JSDOM returns custom-property values with a leading space
  // (see returnToneChoiceFeel.consumer.test.ts:88 for the same quirk).
  el.style.getPropertyValue(name).trim();

describe("tapConfirmFeel consumer (input.choose wiring)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("records the applied feel row when input.choose commits a fork", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // No committing choice yet.
    expect(game?.getAppliedTapConfirmFeel()).toBeNull();

    game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB);

    expect(game?.getAppliedTapConfirmFeel()).toBe(FLAGSHIP_TAP_CONFIRM_FEEL);
  });

  it("stamps the 9 CSS variables + dataset marker onto the choice-specific surface", () => {
    const askSurface = mountTapChoice(AFTERSIGN_ASK_FOR_NEXT_JOB);
    const otherSurface = mountTapChoice("some-other-choice");

    const game = window.__game;
    expect(game).toBeDefined();

    game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB);

    // Dataset marker lands on the choice-specific surface.
    expect(askSurface.dataset.aftersignTapConfirm).toBe("armed");
    // And NOT on the sibling surface — the confirm envelope is a
    // single-button beat, not a tray-wide flash.
    expect(otherSurface.dataset.aftersignTapConfirm).toBeUndefined();

    // Sample one variable per axis — the sibling contract test (to
    // land in a follow-up) freezes every field.
    expect(cssVar(askSurface, "--aftersign-tap-confirm-press-ms")).toBe(
      `${FLAGSHIP_TAP_CONFIRM_FEEL.pressMs}ms`,
    );
    expect(cssVar(askSurface, "--aftersign-tap-confirm-press-scale")).toBe(
      `${FLAGSHIP_TAP_CONFIRM_FEEL.pressScale}`,
    );
    expect(cssVar(askSurface, "--aftersign-tap-confirm-glow-px")).toBe(
      `${FLAGSHIP_TAP_CONFIRM_FEEL.glowPx}px`,
    );
    expect(cssVar(askSurface, "--aftersign-tap-confirm-release-easing")).toBe(
      FLAGSHIP_TAP_CONFIRM_FEEL.releaseEasing,
    );
  });

  it("still records the feel row when no tap-choice surface is mounted", () => {
    expect(
      document.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
    ).toHaveLength(0);

    const game = window.__game;
    game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB);
    expect(game?.getAppliedTapConfirmFeel()).toBe(FLAGSHIP_TAP_CONFIRM_FEEL);
  });

  it("falls back to the first mounted surface when no attribute matches", () => {
    // Slice code that mounts a tap-choice without yet stamping the
    // choiceId onto the attribute (empty value) should still see the
    // confirm envelope land — otherwise juice invisibly regresses on
    // transitional builds. The choice-specific test above locks in
    // the "match wins over fallback" order.
    const bare = document.createElement("button");
    bare.setAttribute("data-aftersign-tap-choice", "");
    document.body.append(bare);

    window.__game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB);
    expect(bare.dataset.aftersignTapConfirm).toBe("armed");
  });
});

describe("attachFlagshipTapConfirmListeners (pointerleave is not a release)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  const dispatch = (el: HTMLElement, type: string): void => {
    // Real PointerEvent isn't reliably constructable in every jsdom
    // build; a plain Event with the right type is enough to exercise
    // the listener bindings this test cares about.
    const event = new Event(type, { bubbles: true });
    el.dispatchEvent(event);
  };

  it("applies the press style on pointerdown and holds it on pointerleave", () => {
    const el = document.createElement("button");
    document.body.append(el);
    const cleanup = attachFlagshipTapConfirmListeners(el);

    dispatch(el, "pointerdown");
    // Press style applied — scale AND box-shadow set.
    expect(el.style.transform).toContain(
      `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.pressScale})`,
    );
    const pressedShadow = el.style.boxShadow;
    expect(pressedShadow).toContain(`${FLAGSHIP_TAP_CONFIRM_FEEL.glowPx}px`);

    // Finger drags off the target — pointerleave fires. The press
    // envelope must NOT collapse; otherwise the player sees the
    // button un-press mid-gesture.
    dispatch(el, "pointerleave");
    expect(el.style.transform).toContain(
      `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.pressScale})`,
    );
    // Shadow held too (the release path is what clears it via
    // setTimeout).
    expect(el.style.boxShadow).toBe(pressedShadow);

    cleanup();
  });

  it("releases on pointerup (finger lifted)", () => {
    const el = document.createElement("button");
    document.body.append(el);
    const cleanup = attachFlagshipTapConfirmListeners(el);

    dispatch(el, "pointerdown");
    expect(el.style.transform).toContain(
      `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.pressScale})`,
    );

    dispatch(el, "pointerup");
    expect(el.style.transform).toContain(
      `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.releaseScale})`,
    );

    cleanup();
  });

  it("releases on pointercancel (scroll steals the pointer)", () => {
    const el = document.createElement("button");
    document.body.append(el);
    const cleanup = attachFlagshipTapConfirmListeners(el);

    dispatch(el, "pointerdown");
    dispatch(el, "pointercancel");
    expect(el.style.transform).toContain(
      `scale(${FLAGSHIP_TAP_CONFIRM_FEEL.releaseScale})`,
    );

    cleanup();
  });

  it("cleanup removes every listener (post-cleanup pointerdown is a no-op)", () => {
    const el = document.createElement("button");
    document.body.append(el);
    const cleanup = attachFlagshipTapConfirmListeners(el);
    cleanup();

    // Clean baseline before the (should-be-noop) dispatch.
    el.style.transform = "";
    dispatch(el, "pointerdown");
    expect(el.style.transform).toBe("");
  });
});
