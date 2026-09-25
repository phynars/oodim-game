// Unit + consumer tests for the recognition-entry stamp + carry-over
// release guard.
//
// PR #1932 re-review (Soren): the prior draft added a write-only
// `state.interaction.recognitionEnteredAt` stamp with no consumer.
// This file pins BOTH:
//   1. The pure predicate `isReturnToneCarryOverRelease` — a simple
//      "pointer-down predates recognition-entry" comparison.
//   2. The document-level guard `attachReturnToneCarryOverGuard` —
//      a real JSDOM harness that dispatches pointerdown BEFORE the
//      stamp, pointerup AFTER, on a
//      `[data-choice-id="choose-return-tone"]` button, and asserts
//      the button's own click handler never fires.
//
// The consumer test proves the "same release cannot also select a
// newly mounted return-tone control" claim advance()'s comment makes.

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  attachReturnToneCarryOverGuard,
  isReturnToneCarryOverRelease,
  recognitionEnteredAt,
} from "./recognitionEntryTiming.js";

describe("recognitionEnteredAt", () => {
  it("returns performance.now() by default", () => {
    const before = performance.now();
    const stamped = recognitionEnteredAt();
    const after = performance.now();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it("accepts an injected clock (deterministic tests)", () => {
    expect(recognitionEnteredAt(1234)).toBe(1234);
  });
});

describe("isReturnToneCarryOverRelease (pure predicate)", () => {
  it("REJECTS a release whose pointerdown predates the stamp", () => {
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: 500,
        recognitionEnteredAt: 1000,
      }),
    ).toBe(true);
  });

  it("accepts a fresh press whose pointerdown POSTdates the stamp", () => {
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: 1500,
        recognitionEnteredAt: 1000,
      }),
    ).toBe(false);
  });

  it("accepts a press whose pointerdown lands exactly ON the stamp", () => {
    // A press that lands on the same frame the beat mounted is a
    // legitimate deliberate tap, not a carry-over.
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: 1000,
        recognitionEnteredAt: 1000,
      }),
    ).toBe(false);
  });

  it("is a no-op when the stamp has not been written yet", () => {
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: 500,
        recognitionEnteredAt: null,
      }),
    ).toBe(false);
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: 500,
        recognitionEnteredAt: undefined,
      }),
    ).toBe(false);
  });

  it("is a no-op when no matching pointerdown was seen", () => {
    // If we didn't record the press we cannot make a claim about
    // carry-over; fail safe (accept) rather than block a legitimate
    // release the guard just didn't observe.
    expect(
      isReturnToneCarryOverRelease({
        pointerDownAtMs: null,
        recognitionEnteredAt: 1000,
      }),
    ).toBe(false);
  });
});

describe("attachReturnToneCarryOverGuard (JSDOM consumer)", () => {
  /** @type {JSDOM} */
  let dom;
  /** @type {HTMLButtonElement} */
  let toneButton;
  /** @type {ReturnType<typeof vi.fn>} */
  let commitSpy;
  /** @type {{ interaction: { recognitionEnteredAt: number | null } }} */
  let state;
  /** @type {number} */
  let nowMs;
  /** @type {() => void} */
  let detach;

  beforeEach(() => {
    dom = new JSDOM(`
      <!doctype html>
      <html>
        <body>
          <button
            id="tone-kind"
            data-choice-id="choose-return-tone"
            data-return-reason="kind"
          >kind</button>
          <button id="unrelated" data-choice-id="ask-for-next-job">next</button>
        </body>
      </html>
    `);
    toneButton = /** @type {HTMLButtonElement} */ (
      dom.window.document.querySelector("#tone-kind")
    );

    // Simulate main.js's tone-button click listener that commits the
    // fork. If the guard fires, `event.stopImmediatePropagation()`
    // prevents this listener from ever running. If the guard doesn't
    // fire (fresh press), this listener runs and commitSpy is called.
    commitSpy = vi.fn();
    toneButton.addEventListener("click", commitSpy);
    // Also listen on pointerup — same-phase downstream listener that
    // in the served page might commit through the pointer event
    // directly (belt + braces).
    toneButton.addEventListener("pointerup", commitSpy);

    state = { interaction: { recognitionEnteredAt: null } };
    nowMs = 0;
    detach = attachReturnToneCarryOverGuard({
      document: dom.window.document,
      getState: () => state,
      now: () => nowMs,
    });
  });

  afterEach(() => {
    detach();
    dom.window.close();
  });

  /**
   * Dispatch a DOM event shaped like the real browser dispatches it.
   *
   * - `pointerdown` / `pointerup`: `PointerEvent`-shape — carries a
   *   `pointerId`. We use MouseEvent + `Object.defineProperty` because
   *   JSDOM's PointerEvent constructor is spotty; the guard only reads
   *   `event.pointerId` and standard MouseEvent fields.
   * - `click`: plain `MouseEvent` — per the pointer-events spec, a
   *   pointer-derived click carries NO `pointerId`. This test mirrors
   *   that so a bug where the guard reads `pointerId` off the click
   *   would show up as a failing test.
   *
   * @param {"pointerdown" | "pointerup" | "click"} type
   * @param {HTMLElement} target
   * @param {number} pointerId
   */
  const dispatch = (type, target, pointerId = 1) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
    });
    if (type === "pointerdown" || type === "pointerup") {
      Object.defineProperty(event, "pointerId", { value: pointerId });
    }
    target.dispatchEvent(event);
    return event;
  };

  it("REJECTS a carry-over release: pointerdown before stamp, pointerup + click after", () => {
    // The scenario the stamp was written to defend against —
    // - t=100: finger presses somewhere (e.g. the recognition-entry
    //   surface). We record the pointerdown.
    // - t=500: advance() runs, transitions to the recognition beat,
    //   stamps `state.interaction.recognitionEnteredAt = 500`, and
    //   mounts the three tone buttons under the finger.
    // - t=520: the same finger's pointerup + derived click lands on
    //   the freshly mounted "kind" tone button. Without the guard
    //   this would commit `choose-return-tone`.
    nowMs = 100;
    dispatch("pointerdown", toneButton);

    state.interaction.recognitionEnteredAt = 500;

    nowMs = 520;
    dispatch("pointerup", toneButton);
    dispatch("click", toneButton);

    expect(commitSpy).not.toHaveBeenCalled();
  });

  it("REJECTS the derived click via the pointerup-armed latch (main.js binds on 'click')", () => {
    // `acknowledgeRouteButton` in main.js binds the tone-button
    // commit as a `click` listener — the served path. Real browser
    // `click` MouseEvents carry NO `pointerId` (see the dispatch()
    // helper above; we mirror that here). The guard therefore
    // defends the click path via the latch armed by the paired
    // `pointerup`, NOT by re-reading pointerId off the click.
    const clickOnlySpy = vi.fn();
    toneButton.removeEventListener("click", commitSpy);
    toneButton.removeEventListener("pointerup", commitSpy);
    toneButton.addEventListener("click", clickOnlySpy);

    nowMs = 100;
    dispatch("pointerdown", toneButton);
    state.interaction.recognitionEnteredAt = 500;
    nowMs = 520;
    // Full pointer-derived sequence: pointerup arms the latch, the
    // click that follows is consumed by it.
    dispatch("pointerup", toneButton);
    dispatch("click", toneButton);

    expect(clickOnlySpy).not.toHaveBeenCalled();
  });

  it("does NOT block a click whose target differs from the latched tone button", () => {
    // The latch is same-target: a carry-over pointerup on one tone
    // button must not swallow a click on a different button. (In
    // practice this can't happen — the pointerup and click share
    // one gesture — but a stray click bug elsewhere in the doc
    // should not be silently eaten by the latch.)
    dom.window.document.body.insertAdjacentHTML(
      "beforeend",
      `<button id="tone-brisk" data-choice-id="choose-return-tone">brisk</button>`,
    );
    const otherToneButton = /** @type {HTMLButtonElement} */ (
      dom.window.document.querySelector("#tone-brisk")
    );
    const otherSpy = vi.fn();
    otherToneButton.addEventListener("click", otherSpy);

    nowMs = 100;
    dispatch("pointerdown", toneButton);
    state.interaction.recognitionEnteredAt = 500;
    nowMs = 520;
    dispatch("pointerup", toneButton); // arms latch on `toneButton`
    // A click on a DIFFERENT button must pass through.
    dispatch("click", otherToneButton);

    expect(otherSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT block a click whose latch has aged past the budget", () => {
    // Defensive: if the click somehow never arrives within the
    // pointer-derived window (~10ms in practice, 500ms budget here),
    // an unrelated later click on the same button must not be eaten.
    nowMs = 100;
    dispatch("pointerdown", toneButton);
    state.interaction.recognitionEnteredAt = 500;
    nowMs = 520;
    dispatch("pointerup", toneButton); // arms latch at t=520

    // A fresh deliberate click much later — well past the 500ms latch.
    nowMs = 2000;
    dispatch("click", toneButton);

    expect(commitSpy).toHaveBeenCalled();
  });

  it("accepts a fresh press: pointerdown after the stamp", () => {
    // Deliberate tap on the tone button AFTER the beat mounted.
    // The guard must be transparent.
    state.interaction.recognitionEnteredAt = 500;

    nowMs = 600;
    dispatch("pointerdown", toneButton);

    nowMs = 620;
    dispatch("pointerup", toneButton);

    // Click listener bound to the button ran at least once (pointerup
    // + click in a browser; here we assert the pointerup listener
    // fired — that's the load-bearing signal).
    expect(commitSpy).toHaveBeenCalled();
  });

  it("is a no-op on unrelated buttons (guard only fires on choose-return-tone)", () => {
    const unrelated = /** @type {HTMLButtonElement} */ (
      dom.window.document.querySelector("#unrelated")
    );
    const unrelatedSpy = vi.fn();
    unrelated.addEventListener("pointerup", unrelatedSpy);

    // Even with a carry-over shape, an ask-for-next-job release
    // must pass through — this guard is scoped to the return-tone
    // commit path.
    nowMs = 100;
    dispatch("pointerdown", unrelated);

    state.interaction.recognitionEnteredAt = 500;

    nowMs = 520;
    dispatch("pointerup", unrelated);

    expect(unrelatedSpy).toHaveBeenCalledTimes(1);
  });

  it("is a no-op before the stamp is written (fresh boot)", () => {
    // On a fresh boot the stamp is null. The guard must not block
    // a tone-button release just because there's no reference point.
    // (In practice the tone buttons aren't mounted yet, but a
    // defensive test pins the null branch.)
    nowMs = 100;
    dispatch("pointerdown", toneButton);

    nowMs = 120;
    dispatch("pointerup", toneButton);

    expect(commitSpy).toHaveBeenCalled();
  });

  it("reports the rejection reason to the optional onReject observer", () => {
    detach();
    const onReject = vi.fn();
    detach = attachReturnToneCarryOverGuard({
      document: dom.window.document,
      getState: () => state,
      now: () => nowMs,
      onReject,
    });

    nowMs = 100;
    dispatch("pointerdown", toneButton);
    state.interaction.recognitionEnteredAt = 500;
    nowMs = 520;
    dispatch("pointerup", toneButton);

    expect(onReject).toHaveBeenCalledWith("carry-over");
  });

  it("detach() removes both listeners so a later carry-over release commits", () => {
    detach();

    nowMs = 100;
    dispatch("pointerdown", toneButton);
    state.interaction.recognitionEnteredAt = 500;
    nowMs = 520;
    dispatch("pointerup", toneButton);

    // Guard is gone — the commit listener runs.
    expect(commitSpy).toHaveBeenCalled();
  });
});
