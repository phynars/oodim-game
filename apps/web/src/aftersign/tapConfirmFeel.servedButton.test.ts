// Served-button PLAYED spec for the flagship tap-confirm feel.
//
// The sibling `tapConfirmFeel.consumer.test.ts` mounts synthetic
// tap-choice nodes and drives them through the harness's
// `window.__game.input.choose(...)` seam — that proves the FEEL
// projection wiring works, but the reviewer on PR #1299 correctly
// flagged that a synthetic-node test doesn't prove the ACTUAL
// rendered buttons in the served `aftersign/index.html` accept the
// envelope. If someone in the future renames a button, drops the
// `data-aftersign-tap-choice` attribute, or ships a fifth committing
// button without the attribute, the synthetic spec stays green while
// the real page silently loses feel.
//
// This spec closes that gap by loading the REAL served HTML, parsing
// the four committing buttons out of it, and calling
// `applyFlagshipTapConfirmFeel` on each. The buttons under test are
// the same four the `servedSurface.contract.test.ts` grep-pin locks
// onto (`packet`, `acknowledge-kiosk`, `skip-kiosk-acknowledge`,
// `deliver-packet`), so any drift between "the button exists in the
// static markup" and "the writer stamps its envelope" reds here.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (that pulls in THREE.js and
//     the whole scene graph — out of scope for a unit test). The
//     grep-level contract test pins that main.js calls the writer;
//     THIS spec pins that the DOM the writer receives from main.js
//     is shaped correctly.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyFlagshipTapConfirmFeel,
  FLAGSHIP_TAP_CONFIRM_FEEL,
} from "./tapConfirmFeel";
import { AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR } from "./tapChoiceFeel";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const COMMITTING_CHOICE_IDS = [
  "packet",
  "acknowledge-kiosk",
  "skip-kiosk-acknowledge",
  "deliver-packet",
] as const;

describe("tapConfirmFeel served-button spec (drives the rendered aftersign/index.html)", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
  });

  afterEach(() => {
    dom.window.close();
  });

  it("finds every committing button in the served static markup", () => {
    // The four buttons the shipped page renders — the ones main.js
    // wires an `applyTapConfirmFeel(choiceId)` call to. If any of
    // these disappear (rename, restructure, drop the attribute),
    // this pin reds BEFORE the writer is even exercised.
    const doc = dom.window.document;
    for (const choiceId of COMMITTING_CHOICE_IDS) {
      const surface = doc.querySelector(
        `[data-aftersign-tap-choice="${choiceId}"]`,
      );
      expect(surface, `served page must render a button for "${choiceId}"`)
        .not.toBeNull();
      expect(surface?.tagName.toLowerCase()).toBe("button");
    }

    // And the tap-choice selector must find exactly the same four
    // (or more — a future committing button would be caught by the
    // servedSurface contract test's `data-aftersign-tap-choice=...`
    // pin block).
    const all = doc.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR);
    expect(all.length).toBeGreaterThanOrEqual(COMMITTING_CHOICE_IDS.length);
  });

  it("stamps the tap-confirm envelope on each rendered committing button", () => {
    const doc = dom.window.document;

    for (const choiceId of COMMITTING_CHOICE_IDS) {
      const surface = doc.querySelector(
        `[data-aftersign-tap-choice="${choiceId}"]`,
      ) as HTMLElement;
      expect(surface).not.toBeNull();

      // Sanity: no envelope before the writer runs.
      expect(surface.dataset.aftersignTapConfirm).toBeUndefined();

      const applied = applyFlagshipTapConfirmFeel(surface);

      // Writer returned the frozen row — same object identity every
      // call, so a caller can `===` to detect a stale copy.
      expect(applied).toBe(FLAGSHIP_TAP_CONFIRM_FEEL);

      // Dataset marker lands on THIS specific rendered button.
      expect(surface.dataset.aftersignTapConfirm).toBe("armed");

      // Sample one CSS variable per axis to confirm the writer
      // reached the real style layer, not just the dataset.
      expect(
        surface.style.getPropertyValue("--aftersign-tap-confirm-press-ms").trim(),
      ).toBe(`${FLAGSHIP_TAP_CONFIRM_FEEL.pressMs}ms`);
      expect(
        surface.style.getPropertyValue("--aftersign-tap-confirm-glow-px").trim(),
      ).toBe(`${FLAGSHIP_TAP_CONFIRM_FEEL.glowPx}px`);
      expect(
        surface.style
          .getPropertyValue("--aftersign-tap-confirm-release-easing")
          .trim(),
      ).toBe(FLAGSHIP_TAP_CONFIRM_FEEL.releaseEasing);
    }
  });

  it("stamps ONLY the targeted button — siblings stay clean", () => {
    // The confirm envelope is a single-button beat. If a future
    // refactor changes the writer to walk `querySelectorAll` (or
    // main.js starts calling it on every button in the tray by
    // accident), this pin reds — because the shipped juice smears
    // across the tray, not lands on the finger.
    const doc = dom.window.document;
    const target = doc.querySelector(
      `[data-aftersign-tap-choice="deliver-packet"]`,
    ) as HTMLElement;
    applyFlagshipTapConfirmFeel(target);

    for (const choiceId of COMMITTING_CHOICE_IDS) {
      if (choiceId === "deliver-packet") continue;
      const other = doc.querySelector(
        `[data-aftersign-tap-choice="${choiceId}"]`,
      ) as HTMLElement;
      expect(
        other.dataset.aftersignTapConfirm,
        `sibling button "${choiceId}" must NOT be armed`,
      ).toBeUndefined();
    }
  });
});
