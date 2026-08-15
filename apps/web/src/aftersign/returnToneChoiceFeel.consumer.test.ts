// Consumer test for the return-tone choice feel wiring.
//
// `bootAftersignWindowGame` is the runtime consumer of
// `applyAftersignReturnToneChoiceFeel` — this jsdom test drives the
// harness's `setIoReturnReason` seam and asserts:
//   1. The applied feel row IS the table row for that posture (ground
//      truth wiring — independent of whether the DOM surface exists).
//   2. When a `[data-aftersign-return-surface]` element is mounted, the
//      13 CSS variables + dataset marker land on it end-to-end.
//   3. Clearing the reason clears the applied feel — no stale posture
//      leaks across encounters.
//
// Scope guard:
//   - does NOT touch the ms/px/hz numbers in
//     AFTERSIGN_RETURN_TONE_CHOICE_FEEL — the sibling
//     `returnToneChoiceFeel.contract.test.ts` pins those.
//   - does NOT re-derive dialogue lines; the harness's voice-thread
//     projection is covered by
//     `harness/windowGameHarnessBoot.test.ts`.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_RETURN_TONE_CHOICE_FEEL,
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
} from "./returnToneChoiceFeel";
import "./harness/bootWindowGame";

const SURFACE_SELECTOR = AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR;

function mountSurface(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-aftersign-return-surface", "");
  document.body.append(el);
  return el;
}

describe("returnToneChoiceFeel consumer (setIoReturnReason wiring)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Reset the harness's return-tone memory between assertions by
    // clearing the reason. `window.__game` is booted at module load
    // (see `harness/bootWindowGame.ts:bootAftersignWindowGame();`).
    window.__game?.setIoReturnReason(null);
  });

  afterEach(() => {
    window.__game?.setIoReturnReason(null);
    document.body.innerHTML = "";
  });

  it("records the applied feel row when setIoReturnReason is called with a posture", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // No posture recorded yet.
    expect(game?.getAppliedReturnToneFeel()).toBeNull();

    game?.setIoReturnReason("kind");
    expect(game?.getAppliedReturnToneFeel()).toBe(
      AFTERSIGN_RETURN_TONE_CHOICE_FEEL.kind,
    );

    game?.setIoReturnReason("evasive");
    expect(game?.getAppliedReturnToneFeel()).toBe(
      AFTERSIGN_RETURN_TONE_CHOICE_FEEL.evasive,
    );

    game?.setIoReturnReason("blunt");
    expect(game?.getAppliedReturnToneFeel()).toBe(
      AFTERSIGN_RETURN_TONE_CHOICE_FEEL.blunt,
    );
  });

  it("stamps the CSS variables onto the mounted return-tone surface", () => {
    const surface = mountSurface();
    const game = window.__game;
    expect(game).toBeDefined();

    game?.setIoReturnReason("evasive");

    // Dataset marker matches the applied posture.
    expect(surface.dataset.aftersignReturnTone).toBe("evasive");

    // JSDOM returns custom-property values with a leading space
    // (see `aftersignConfirmFeel.consumer.test.ts:114` — the sibling
    // green test already .trim()s for the same reason). Wrap every
    // read so equality comparisons aren't tripped by " 0px" vs "0px".
    const cssVar = (name: string): string =>
      surface.style.getPropertyValue(name).trim();

    // Sample a few variables against the pinned table row. The
    // sibling contract test covers every field per posture; here we
    // just prove the harness routed the write to the surface.
    const evasive = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.evasive;
    expect(cssVar("--aftersign-return-press-ms")).toBe(`${evasive.pressMs}ms`);
    expect(cssVar("--aftersign-return-halo-scale")).toBe(
      `${evasive.haloScale}`,
    );
    expect(cssVar("--aftersign-return-shake-px")).toBe(`${evasive.shakePx}px`);
    expect(cssVar("--aftersign-return-tone-hz")).toBe(
      `${evasive.audioCue.frequencyHz}`,
    );
  });

  it("re-stamps the surface when the posture changes mid-encounter", () => {
    const surface = mountSurface();
    const game = window.__game;
    expect(game).toBeDefined();

    // Same .trim() wrap as above — jsdom's leading-space quirk.
    const cssVar = (name: string): string =>
      surface.style.getPropertyValue(name).trim();

    game?.setIoReturnReason("kind");
    expect(cssVar("--aftersign-return-shake-px")).toBe("0px");

    game?.setIoReturnReason("blunt");
    // Blunt has shakePx=2 — the second stamp must clobber the first.
    expect(cssVar("--aftersign-return-shake-px")).toBe("2px");
    expect(surface.dataset.aftersignReturnTone).toBe("blunt");
    // And the applied-row getter tracks the latest.
    expect(game?.getAppliedReturnToneFeel()).toBe(
      AFTERSIGN_RETURN_TONE_CHOICE_FEEL.blunt,
    );
  });

  it("clears the applied feel row when setIoReturnReason(null) is called", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.setIoReturnReason("blunt");
    expect(game?.getAppliedReturnToneFeel()).not.toBeNull();

    game?.setIoReturnReason(null);
    expect(game?.getAppliedReturnToneFeel()).toBeNull();
  });

  it("still records the feel row when no surface element is mounted", () => {
    // The mount step is skipped here — document.body is empty from
    // beforeEach. The wiring must not silently swallow the posture.
    expect(document.querySelector(SURFACE_SELECTOR)).toBeNull();

    const game = window.__game;
    game?.setIoReturnReason("kind");
    expect(game?.getAppliedReturnToneFeel()).toBe(
      AFTERSIGN_RETURN_TONE_CHOICE_FEEL.kind,
    );
  });
});
