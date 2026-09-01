// Consumer test for the offered-job action feel wiring (PR #1576
// re-review). `renderAftersignJobOfferActionButton` is the runtime
// consumer of `getAftersignJobOfferActionFeelAttributes` — this jsdom
// test builds the button, verifies every `data-aftersign-feel-*`
// attribute + CSS custom property lands, and drives `pointerdown` /
// `pointerup` to prove the press class toggles on tap.
//
// Scope guard:
//   - does NOT re-pin the ms/px numbers here — the resolver is the
//     single source of truth and we assert equality against it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AFTERSIGN_JOB_OFFER_ACTION_FEEL,
  AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
  AFTERSIGN_JOB_OFFER_ACTION_SELECTOR,
  applyAftersignJobOfferActionFeel,
  getAftersignJobOfferActionFeelAttributes,
  installAftersignJobOfferActionFeelStyles,
  renderAftersignJobOfferActionButton,
  type AftersignJobRiskTone,
} from "./ioJobOfferActionFeel";

const RISK_TONES: AftersignJobRiskTone[] = ["safe", "risky", "consequence"];

// jsdom returns custom-property values with a leading space — trim
// every read (same reason as returnToneChoiceFeel.consumer.test.ts).
const cssVar = (el: HTMLElement, name: string): string =>
  el.style.getPropertyValue(name).trim();

describe("ioJobOfferActionFeel consumer (renderAftersignJobOfferActionButton)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Also clear any installed <style> so the install idempotency
    // assertion below isn't polluted by prior test runs.
    document.head
      .querySelectorAll('style[data-aftersign-job-offer-action-feel="true"]')
      .forEach((node) => node.remove());
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("installs the CSS style block idempotently per document", () => {
    installAftersignJobOfferActionFeelStyles();
    installAftersignJobOfferActionFeelStyles();
    installAftersignJobOfferActionFeelStyles();

    const styles = document.head.querySelectorAll(
      'style[data-aftersign-job-offer-action-feel="true"]',
    );
    expect(styles).toHaveLength(1);

    // The CSS block must target the exact selector the components use.
    expect(styles[0]!.textContent).toContain("[data-aftersign-job-risk]");
    expect(styles[0]!.textContent).toContain(
      AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
    );
    // And it must reference the CSS custom properties the applier writes.
    expect(styles[0]!.textContent).toContain("--aftersign-job-offer-lift");
    expect(styles[0]!.textContent).toContain(
      "--aftersign-job-offer-press-scale",
    );
    expect(styles[0]!.textContent).toContain("--aftersign-job-offer-glow");
    expect(styles[0]!.textContent).toContain(
      "--aftersign-job-offer-border-pulse",
    );
  });

  for (const risk of RISK_TONES) {
    it(`stamps every data-aftersign-feel-* attribute for the ${risk} tone`, () => {
      const { button } = renderAftersignJobOfferActionButton({
        risk,
        label: `Take ${risk} job`,
      });

      const expected = getAftersignJobOfferActionFeelAttributes(risk);
      for (const [name, value] of Object.entries(expected)) {
        expect(button.getAttribute(name)).toBe(value);
      }
    });

    it(`writes CSS custom properties matching the ${risk} feel row`, () => {
      const feel = AFTERSIGN_JOB_OFFER_ACTION_FEEL[risk];
      const { button } = renderAftersignJobOfferActionButton({
        risk,
        label: risk,
      });

      expect(cssVar(button, "--aftersign-job-offer-duration")).toBe(
        `${feel.durationMs}ms`,
      );
      expect(cssVar(button, "--aftersign-job-offer-lift")).toBe(
        `${feel.liftPx}px`,
      );
      expect(cssVar(button, "--aftersign-job-offer-press-scale")).toBe(
        String(feel.pressScale),
      );
      expect(cssVar(button, "--aftersign-job-offer-glow")).toBe(
        String(feel.glowAlpha),
      );
      expect(cssVar(button, "--aftersign-job-offer-border-pulse")).toBe(
        `${feel.borderPulsePx}px`,
      );
      expect(cssVar(button, "--aftersign-job-offer-ease")).toBe(feel.easing);
    });
  }

  it("toggles the pressed class on pointerdown / pointerup (tap-driven)", () => {
    const { button, dispose } = renderAftersignJobOfferActionButton({
      risk: "consequence",
      label: "Take the debt job",
    });
    document.body.append(button);

    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(false);

    button.dispatchEvent(new Event("pointerdown"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(true);

    button.dispatchEvent(new Event("pointerup"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(false);

    dispose();
  });

  it("clears the pressed class on pointercancel / pointerleave (aborted tap)", () => {
    const { button } = renderAftersignJobOfferActionButton({
      risk: "risky",
      label: "Maybe",
    });
    document.body.append(button);

    button.dispatchEvent(new Event("pointerdown"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(true);
    button.dispatchEvent(new Event("pointercancel"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(false);

    button.dispatchEvent(new Event("pointerdown"));
    button.dispatchEvent(new Event("pointerleave"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(false);
  });

  it("fires onCommit(risk) exactly once per click", () => {
    const onCommit = vi.fn();
    const { button } = renderAftersignJobOfferActionButton({
      risk: "safe",
      label: "Yes",
      onCommit,
    });
    document.body.append(button);

    button.click();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("safe");
  });

  it("stops firing onCommit after dispose() and cleans up press listeners", () => {
    const onCommit = vi.fn();
    const { button, dispose } = renderAftersignJobOfferActionButton({
      risk: "safe",
      label: "Yes",
      onCommit,
    });
    document.body.append(button);

    dispose();

    button.dispatchEvent(new Event("pointerdown"));
    expect(
      button.classList.contains(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS),
    ).toBe(false);

    button.click();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("selector-mounts under [data-aftersign-job-risk] so CSS can target it", () => {
    const { button } = renderAftersignJobOfferActionButton({
      risk: "consequence",
      label: "Sign",
    });
    document.body.append(button);

    const found = document.querySelector(
      AFTERSIGN_JOB_OFFER_ACTION_SELECTOR,
    );
    expect(found).toBe(button);
    // And the debt-thrum tone selector matches too — this is what
    // drives the consequence-tier's slow border pulse from CSS.
    expect(
      document.querySelector('[data-aftersign-job-risk="consequence"]'),
    ).toBe(button);
  });

  it("applyAftersignJobOfferActionFeel stamps a pre-existing element (component-agnostic seam)", () => {
    // A framework component that renders its own <button> (React,
    // Solid, plain innerHTML template) can call the applier directly
    // instead of the render helper — this proves the seam works.
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = "External component";
    document.body.append(el);

    const feel = applyAftersignJobOfferActionFeel(el, "risky");

    expect(el.getAttribute("data-aftersign-job-risk")).toBe("risky");
    expect(el.getAttribute("data-aftersign-feel-duration-ms")).toBe(
      String(feel.durationMs),
    );
    expect(cssVar(el, "--aftersign-job-offer-lift")).toBe(`${feel.liftPx}px`);
    expect(feel).toBe(AFTERSIGN_JOB_OFFER_ACTION_FEEL.risky);
  });
});
