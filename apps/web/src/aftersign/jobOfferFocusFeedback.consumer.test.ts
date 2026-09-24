// Consumer test for `aftersign/src/jobOfferFocusFeedback.js` — the
// main.js-facing "keep the committed offer visibly latched" cue that
// runs on the click callback (aftersign/main.js:~2499) after
// `applyJobOfferChoiceFeedback` fires.
//
// This test is the trip-wire Soren's PR #1914 REQUEST_CHANGES demanded:
// every sibling feel module (jobOfferChoiceFeedback.consumer.test.ts,
// ioJobOfferActionFeel.consumer.test.ts) ships one, and without it
// green CI proves nothing — duration, easing, the committed-latch
// clearing at 180ms, and the outline-consumer wiring are all driftable
// with no assertion.
//
// Scope pinned here:
//   1. `data-aftersign-job-offer-committed` dataset marker stamped
//      immediately, cleared at exactly `JOB_OFFER_FOCUS_FEEDBACK_MS`.
//   2. `--aftersign-job-offer-commit-duration` custom property set to
//      `${JOB_OFFER_FOCUS_FEEDBACK_MS}ms`, cleared at 180ms.
//   3. One-time `<style>` block installed on first call (idempotent
//      across many calls, one per document) that references BOTH the
//      dataset selector and the custom-property token — closes the
//      AI006 "dead surface" flag by making both tokens load-bearing.
//   4. `button.animate` called with the shipped boxShadow keyframe,
//      180ms duration, and the cubic-bezier easing — the visible glow
//      channel the served surface renders on the committed button.
//   5. The returned cancel function removes the marker, clears the
//      var, and cancels the WAAPI animation early (touch-release path
//      main.js may want if a future refactor introduces a cancel gate).
//
// Non-scope: does NOT re-pin the transform-authority (press feedback
// owns that — asserted by the sibling jobOfferChoiceFeedback consumer
// test). This test asserts the FOCUS channel only, so drift in either
// half reds independently.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  JOB_OFFER_FOCUS_FEEDBACK_MS,
  playJobOfferFocusFeedback,
} from "../../../../aftersign/src/jobOfferFocusFeedback.js";

const STYLE_SELECTOR =
  'style[data-aftersign-job-offer-focus-feedback="true"]';

// jsdom returns custom-property values with a leading space — trim
// every read (same reason as returnToneChoiceFeel / ioJobOfferActionFeel
// / jobOfferChoiceFeedback consumer tests).
const cssVar = (el: HTMLElement, name: string): string =>
  el.style.getPropertyValue(name).trim();

describe("jobOfferFocusFeedback (main.js consumer)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.querySelectorAll(STYLE_SELECTOR).forEach((n) => n.remove());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    document.head.querySelectorAll(STYLE_SELECTOR).forEach((n) => n.remove());
  });

  it("stamps data-aftersign-job-offer-committed and the commit-duration var immediately", () => {
    const button = document.createElement("button");
    document.body.append(button);
    // jsdom's HTMLElement has no `.animate` — attach a spy so the
    // WAAPI branch runs (test-4 asserts the call payload).
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    (button as unknown as { animate: typeof animate }).animate = animate;

    playJobOfferFocusFeedback(button);

    expect(button.dataset.aftersignJobOfferCommitted).toBe("true");
    expect(cssVar(button, "--aftersign-job-offer-commit-duration")).toBe(
      `${JOB_OFFER_FOCUS_FEEDBACK_MS}ms`,
    );
  });

  it("installs the outline consumer <style> block on first call (idempotent)", () => {
    const buttonA = document.createElement("button");
    const buttonB = document.createElement("button");
    document.body.append(buttonA, buttonB);
    (buttonA as unknown as { animate: () => unknown }).animate = () => ({
      cancel: () => {},
    });
    (buttonB as unknown as { animate: () => unknown }).animate = () => ({
      cancel: () => {},
    });

    playJobOfferFocusFeedback(buttonA);
    playJobOfferFocusFeedback(buttonB);
    playJobOfferFocusFeedback(buttonA);

    const styles = document.head.querySelectorAll(STYLE_SELECTOR);
    expect(styles).toHaveLength(1);

    // The installed CSS MUST reference BOTH tokens the module stamps —
    // this is what makes them load-bearing (AI006 fix from PR #1914).
    // If either token is renamed here without renaming in the style
    // block below, this reds.
    const css = styles[0]!.textContent ?? "";
    expect(css).toContain('data-aftersign-job-offer-committed="true"');
    expect(css).toContain("--aftersign-job-offer-commit-duration");
  });

  it("calls button.animate with the shipped boxShadow keyframe, 180ms duration, and cubic-bezier easing", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    (button as unknown as { animate: typeof animate }).animate = animate;

    playJobOfferFocusFeedback(button);

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0]!;
    // Three keyframes — 0/peak/residue on boxShadow.
    expect(Array.isArray(keyframes)).toBe(true);
    expect((keyframes as unknown[]).length).toBe(3);
    for (const frame of keyframes as Array<Record<string, unknown>>) {
      expect(typeof frame.boxShadow).toBe("string");
    }
    expect(options).toMatchObject({
      duration: JOB_OFFER_FOCUS_FEEDBACK_MS,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  });

  it("clears the dataset marker and the commit-duration var at JOB_OFFER_FOCUS_FEEDBACK_MS", () => {
    const button = document.createElement("button");
    document.body.append(button);
    (button as unknown as { animate: () => unknown }).animate = () => ({
      cancel: () => {},
    });

    playJobOfferFocusFeedback(button);

    // Just before the deadline the latch is still on.
    vi.advanceTimersByTime(JOB_OFFER_FOCUS_FEEDBACK_MS - 1);
    expect(button.dataset.aftersignJobOfferCommitted).toBe("true");
    expect(cssVar(button, "--aftersign-job-offer-commit-duration")).toBe(
      `${JOB_OFFER_FOCUS_FEEDBACK_MS}ms`,
    );

    // At the deadline both tokens clear.
    vi.advanceTimersByTime(2);
    expect(button.dataset.aftersignJobOfferCommitted).toBeUndefined();
    expect(cssVar(button, "--aftersign-job-offer-commit-duration")).toBe("");
  });

  it("cancel() removes the marker, clears the var, and cancels the WAAPI animation", () => {
    const button = document.createElement("button");
    document.body.append(button);
    const cancel = vi.fn();
    (button as unknown as { animate: () => unknown }).animate = () => ({
      cancel,
    });

    const dispose = playJobOfferFocusFeedback(button);
    expect(button.dataset.aftersignJobOfferCommitted).toBe("true");

    dispose();

    expect(button.dataset.aftersignJobOfferCommitted).toBeUndefined();
    expect(cssVar(button, "--aftersign-job-offer-commit-duration")).toBe("");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op cancel and does nothing when button is nullish", () => {
    // Defensive path — same shape as applyJobOfferChoiceFeedback's
    // null-guard. A future refactor may hand a GC'd handle through.
    const nullDispose = playJobOfferFocusFeedback(
      null as unknown as HTMLElement,
    );
    const undefDispose = playJobOfferFocusFeedback(
      undefined as unknown as HTMLElement,
    );
    expect(typeof nullDispose).toBe("function");
    expect(typeof undefDispose).toBe("function");
    // Calling them must not throw.
    expect(() => nullDispose()).not.toThrow();
    expect(() => undefDispose()).not.toThrow();
    // No style block leaked into <head> from a null-guarded call.
    expect(document.head.querySelectorAll(STYLE_SELECTOR)).toHaveLength(0);
  });
});
