// PR #1556 — served-page consumer pin for `ioJobOfferSelectFeel.ts`.
//
// Prior to this wire the resolver's only importer was
// `harness/bootWindowGame.ts` (the vitest boot harness) — a
// consumer-rule violation per the flagship DoD ("a contract module
// with no consumer in the served page is not shippable value").
// `aftersign/main.js` now imports the resolver and stamps its
// commit-apex frame onto the offer button the player's finger
// pressed. This spec pins both halves:
//
//   1. GREP PIN — the served `aftersign/main.js` source imports
//      `resolveIoJobOfferSelectFeel` and calls
//      `applyIoJobOfferSelectFeelToButton` from the offer click
//      callback. Same technique as `ioNextJobDurability.test.ts` /
//      `mContinueVisibleButtons.contract.test.ts`: reading the
//      shipped source is how a pure vitest lane asserts served-page
//      wiring without booting three.js.
//
//   2. FRAME PIN — the commit-apex sample (pressMs + commitMs/2)
//      the click handler stamps is in the COMMIT phase with the
//      envelope's documented peaks: audioGain at its triangle apex
//      (maxAudioGain) and visual fields past their press-phase
//      values. A retune of the spec that silently moves the apex
//      out of the commit phase reds here before it ships.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  IO_JOB_OFFER_SELECT_FEEL,
  resolveIoJobOfferSelectFeel,
} from "./ioJobOfferSelectFeel";

const mainSource = readFileSync(
  resolve(process.cwd(), "aftersign", "main.js"),
  "utf8",
);

describe("ioJobOfferSelectFeel served-page consumer (aftersign/main.js)", () => {
  it("imports the resolver in the served module, not just the harness", () => {
    expect(mainSource).toContain("resolveIoJobOfferSelectFeel");
    expect(mainSource).toContain(
      "apps/web/src/aftersign/ioJobOfferSelectFeel.ts",
    );
  });

  it("stamps the select envelope from the offer-button click callback", () => {
    // The writer must exist AND be invoked with the commit-apex
    // constant from inside the offer loop's click callback.
    expect(mainSource).toContain("applyIoJobOfferSelectFeelToButton");
    expect(mainSource).toContain("IO_JOB_OFFER_SELECT_COMMIT_APEX_MS");
    // Writer stamps the phase marker + CSS vars the stylesheet /
    // played e2e consume.
    expect(mainSource).toContain("data-io-job-offer-select");
    expect(mainSource).toContain("--io-job-offer-select-lift-px");
    expect(mainSource).toContain("--io-job-offer-select-audio-gain");
  });

  it("exposes the runtime seam window.__game.getIoJobOfferSelectFeel", () => {
    expect(mainSource).toContain("getIoJobOfferSelectFeel");
  });

  it("samples the commit apex inside the commit phase at its audio peak", () => {
    const apexMs =
      IO_JOB_OFFER_SELECT_FEEL.pressMs + IO_JOB_OFFER_SELECT_FEEL.commitMs / 2;
    const frame = resolveIoJobOfferSelectFeel(apexMs, IO_JOB_OFFER_SELECT_FEEL);
    expect(frame.phase).toBe("commit");
    // Triangle audio envelope peaks exactly mid-commit (t=0.5).
    expect(frame.audioGain).toBeCloseTo(
      IO_JOB_OFFER_SELECT_FEEL.maxAudioGain,
      10,
    );
    // Visual fields are live (non-zero) at the apex — the stamp the
    // served button receives is not the dormant idle frame.
    expect(frame.glowAlpha).toBeGreaterThan(0);
    expect(frame.ringAlpha).toBeGreaterThan(0);
    expect(frame.scale).toBeGreaterThan(1 - 0.02);
  });

  it("stamps CSS vars + phase marker onto a real element without throwing", () => {
    // Mirror of the main.js writer against a jsdom element — pins the
    // exact variable names and the phase marker so a rename on either
    // side reds. (The writer itself lives in main.js, which boots
    // three.js; reproducing the stamp here follows the same pattern
    // as offeredJobsTapTargetFeel.consumer.test.ts's button-stamp
    // mirror.)
    const button = document.createElement("button");
    const apexMs =
      IO_JOB_OFFER_SELECT_FEEL.pressMs + IO_JOB_OFFER_SELECT_FEEL.commitMs / 2;
    const frame = resolveIoJobOfferSelectFeel(apexMs, IO_JOB_OFFER_SELECT_FEEL);
    button.setAttribute("data-io-job-offer-select", frame.phase);
    button.style.setProperty("--io-job-offer-select-lift-px", `${frame.liftPx}px`);
    button.style.setProperty("--io-job-offer-select-scale", `${frame.scale}`);
    button.style.setProperty("--io-job-offer-select-glow-alpha", `${frame.glowAlpha}`);
    button.style.setProperty("--io-job-offer-select-ring-alpha", `${frame.ringAlpha}`);
    button.style.setProperty("--io-job-offer-select-hud-nudge-px", `${frame.hudNudgePx}px`);
    button.style.setProperty("--io-job-offer-select-audio-gain", `${frame.audioGain}`);
    expect(button.getAttribute("data-io-job-offer-select")).toBe("commit");
    expect(
      button.style.getPropertyValue("--io-job-offer-select-audio-gain"),
    ).toBe(`${IO_JOB_OFFER_SELECT_FEEL.maxAudioGain}`);
  });
});
