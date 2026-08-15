import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_RETURN_TONE_CHOICE_FEEL,
  AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR,
  applyAftersignReturnToneChoiceFeel,
  getAftersignReturnToneChoiceFeel,
  type AftersignReturnToneChoice,
} from "./returnToneChoiceFeel";

// Contract test for the return-tone choice feel table.
//
// Sibling to `aftersignConfirmFeel.contract.test.ts` — every ms/px/hz
// number for every posture is pinned explicitly so a "just a tiny
// tweak" PR has to update this test alongside the constant. No silent
// drift on 13 numbers × 3 postures = 39 tuned values.
//
// LANE NOTE: this file IS on the aftersign vitest include list
// (`apps/web/src/aftersign/vitest.config.ts`) alongside its paired
// consumer test — the "no silent drift on 39 tuned values" purpose
// only holds if a `pressMs: 72 → 73` edit reds out CI, not just
// typecheck. Adding the file to the include list was the second
// blocker on the review that shipped this module.

const POSTURES: readonly AftersignReturnToneChoice[] = [
  "kind",
  "evasive",
  "blunt",
];

describe("returnToneChoiceFeel — 3 postures × 13 pinned numbers", () => {
  it("exposes exactly the three return-reason postures — no drift from AftersignReturnReason", () => {
    expect(Object.keys(AFTERSIGN_RETURN_TONE_CHOICE_FEEL).sort()).toEqual(
      ["blunt", "evasive", "kind"],
    );
  });

  it("pins every number for the `kind` (gentle) posture", () => {
    const feel = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.kind;
    expect(feel.choice).toBe("kind");
    expect(feel.label).toBe("Kind return");
    expect(feel.pressMs).toBe(72);
    expect(feel.liftPx).toBe(5);
    expect(feel.settleMs).toBe(190);
    expect(feel.easing).toBe("cubic-bezier(0.2, 0.9, 0.18, 1)");
    expect(feel.haloScale).toBeCloseTo(1.08, 5);
    expect(feel.haloFadeMs).toBe(260);
    expect(feel.shakePx).toBe(0);
    expect(feel.audioCue.frequencyHz).toBe(392);
    expect(feel.audioCue.attackMs).toBe(8);
    expect(feel.audioCue.releaseMs).toBe(180);
    expect(feel.audioCue.gain).toBeCloseTo(0.055, 5);
  });

  it("pins every number for the `evasive` (urgent) posture", () => {
    const feel = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.evasive;
    expect(feel.choice).toBe("evasive");
    expect(feel.label).toBe("Evasive return");
    expect(feel.pressMs).toBe(58);
    expect(feel.liftPx).toBe(8);
    expect(feel.settleMs).toBe(150);
    expect(feel.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(feel.haloScale).toBeCloseTo(1.14, 5);
    expect(feel.haloFadeMs).toBe(210);
    expect(feel.shakePx).toBeCloseTo(1.5, 5);
    expect(feel.audioCue.frequencyHz).toBe(523);
    expect(feel.audioCue.attackMs).toBe(5);
    expect(feel.audioCue.releaseMs).toBe(130);
    expect(feel.audioCue.gain).toBeCloseTo(0.07, 5);
  });

  it("pins every number for the `blunt` (defiant) posture", () => {
    const feel = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.blunt;
    expect(feel.choice).toBe("blunt");
    expect(feel.label).toBe("Blunt return");
    expect(feel.pressMs).toBe(84);
    expect(feel.liftPx).toBe(3);
    expect(feel.settleMs).toBe(230);
    expect(feel.easing).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(feel.haloScale).toBeCloseTo(1.2, 5);
    expect(feel.haloFadeMs).toBe(320);
    expect(feel.shakePx).toBe(2);
    expect(feel.audioCue.frequencyHz).toBe(311);
    expect(feel.audioCue.attackMs).toBe(12);
    expect(feel.audioCue.releaseMs).toBe(220);
    expect(feel.audioCue.gain).toBeCloseTo(0.06, 5);
  });

  it("orders postures by press energy — kind is the softest, blunt is the slowest, evasive is the fastest", () => {
    const kind = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.kind;
    const evasive = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.evasive;
    const blunt = AFTERSIGN_RETURN_TONE_CHOICE_FEEL.blunt;

    // Evasive is the shortest press (fastest tap); blunt is the longest.
    expect(evasive.pressMs).toBeLessThan(kind.pressMs);
    expect(kind.pressMs).toBeLessThan(blunt.pressMs);

    // Halo scale climbs with intensity: kind < evasive < blunt.
    expect(kind.haloScale).toBeLessThan(evasive.haloScale);
    expect(evasive.haloScale).toBeLessThan(blunt.haloScale);

    // Kind carries no shake; both harder postures do.
    expect(kind.shakePx).toBe(0);
    expect(evasive.shakePx).toBeGreaterThan(0);
    expect(blunt.shakePx).toBeGreaterThan(0);

    // Audio: evasive is the highest pitch (bright), blunt the lowest (dark).
    expect(evasive.audioCue.frequencyHz).toBeGreaterThan(kind.audioCue.frequencyHz);
    expect(blunt.audioCue.frequencyHz).toBeLessThan(kind.audioCue.frequencyHz);
  });

  it("returns the same row from `getAftersignReturnToneChoiceFeel` as the table lookup", () => {
    for (const posture of POSTURES) {
      expect(getAftersignReturnToneChoiceFeel(posture)).toBe(
        AFTERSIGN_RETURN_TONE_CHOICE_FEEL[posture],
      );
    }
  });

  it("stamps every CSS variable + dataset flag on the target element", () => {
    // jsdom is the aftersign lane's default environment (see
    // `vitest.config.ts`), so `document.createElement` is available.
    const el = document.createElement("div");
    const feel = applyAftersignReturnToneChoiceFeel(el, "evasive");

    // Dataset marker matches the applied choice.
    expect(el.dataset.aftersignReturnTone).toBe("evasive");

    // JSDOM quirk: `getPropertyValue` on a custom property returns the
    // value with a leading space (spec-compliant preservation of the
    // significant-whitespace token). The sibling green test
    // `aftersignConfirmFeel.consumer.test.ts:114` already .trim()s for
    // exactly this reason — mirror that pattern here so the raw value
    // comparison isn't tripped by " 0px" vs "0px".
    const cssVar = (name: string): string =>
      el.style.getPropertyValue(name).trim();

    // All 11 CSS variables are set to unit-suffixed strings that
    // consuming stylesheets can drop into shorthands verbatim.
    expect(cssVar("--aftersign-return-press-ms")).toBe(`${feel.pressMs}ms`);
    expect(cssVar("--aftersign-return-lift-px")).toBe(`${feel.liftPx}px`);
    expect(cssVar("--aftersign-return-settle-ms")).toBe(`${feel.settleMs}ms`);
    expect(cssVar("--aftersign-return-easing")).toBe(feel.easing);
    expect(cssVar("--aftersign-return-halo-scale")).toBe(`${feel.haloScale}`);
    expect(cssVar("--aftersign-return-halo-fade-ms")).toBe(
      `${feel.haloFadeMs}ms`,
    );
    expect(cssVar("--aftersign-return-shake-px")).toBe(`${feel.shakePx}px`);
    expect(cssVar("--aftersign-return-tone-hz")).toBe(
      `${feel.audioCue.frequencyHz}`,
    );
    expect(cssVar("--aftersign-return-tone-attack-ms")).toBe(
      `${feel.audioCue.attackMs}ms`,
    );
    expect(cssVar("--aftersign-return-tone-release-ms")).toBe(
      `${feel.audioCue.releaseMs}ms`,
    );
    expect(cssVar("--aftersign-return-tone-gain")).toBe(
      `${feel.audioCue.gain}`,
    );
  });

  it("overwrites the prior stamp when applied twice with different postures", () => {
    const el = document.createElement("div");
    // See note above — .trim() around every custom-property read.
    const cssVar = (name: string): string =>
      el.style.getPropertyValue(name).trim();

    applyAftersignReturnToneChoiceFeel(el, "kind");
    expect(el.dataset.aftersignReturnTone).toBe("kind");
    expect(cssVar("--aftersign-return-shake-px")).toBe("0px");

    applyAftersignReturnToneChoiceFeel(el, "blunt");
    expect(el.dataset.aftersignReturnTone).toBe("blunt");
    // The blunt row has shakePx=2; the write must clobber the prior
    // "0px" — not merge with it.
    expect(cssVar("--aftersign-return-shake-px")).toBe("2px");
    // And press-ms flips from kind's 72 to blunt's 84.
    expect(cssVar("--aftersign-return-press-ms")).toBe("84ms");
  });

  it("pins the surface selector string — the harness and stylesheets must agree", () => {
    expect(AFTERSIGN_RETURN_TONE_SURFACE_SELECTOR).toBe(
      "[data-aftersign-return-surface]",
    );
  });
});
