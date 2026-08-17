import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./bootWindowGame";

type PointerToRenderLatencySample = {
  pointerAtMs: number;
  renderedAtMs: number;
  deltaMs: number;
  frameBudgetMs: number;
  withinBudget: boolean;
};

type PointerToRenderLatencyProbe = {
  resetPointerToRenderLatency?: () => void;
  markPointerIntent?: (input: { pointerAtMs: number; pointerId: number }) => void;
  markPointerRendered?: (input: { renderedAtMs: number; pointerId: number }) => void;
  getPointerToRenderLatencyReport?: () => {
    latest?: PointerToRenderLatencySample;
    worst?: PointerToRenderLatencySample;
    samples: PointerToRenderLatencySample[];
  };
};

// Pointer-to-render feel contract — CONSUMER TEST (tap-driven).
//
// PR #1283 review (Soren): a probe on the harness surface that's only
// exercised by the harness itself is dead code with green tests. Fix
// is a two-part contract:
//   1. Served-surface pins in `servedSurface.contract.test.ts` prove
//      `aftersign/main.js` imports `measurePointerToRenderLatency`,
//      installs a `document.addEventListener("pointerdown", ...)`,
//      drains pending intents right after `composer.render()`, and
//      exposes the four probe methods on `window.__game.input`.
//   2. THIS FILE — a jsdom consumer test that mounts a real
//      `[data-aftersign-tap-choice]` button, `dispatchEvent`s a real
//      `PointerEvent("pointerdown")` on it, and asserts the harness's
//      pointerdown listener populated the probe. That's the "played,
//      not driven" contract: the sample is authored by a real DOM
//      event, not by a hand-call to `markPointerIntent`.
//
// The render close-out (`markPointerRendered`) is still a harness call
// here — jsdom has no `requestAnimationFrame(composer.render)` for us
// to observe. The served-surface pins above prove the SHIPPED page
// closes the loop against a real rAF tick after `composer.render()`;
// this file's job is to prove the intent side is truly played.

const RECOGNITION_POINTER_TAG = "data-aftersign-tap-choice";

function mountTapChoice(label: string): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute(RECOGNITION_POINTER_TAG, label);
  // Real bounding rect so the button is a plausible tap surface —
  // matches the sibling `tapChoiceFeel.consumer.test.ts` pattern.
  el.getBoundingClientRect = () =>
    ({
      width: 60,
      height: 60,
      top: 0,
      left: 0,
      right: 60,
      bottom: 60,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(el);
  return el;
}

function dispatchPointerdown(el: HTMLElement, pointerId: number): void {
  // jsdom implements `PointerEvent` in recent versions; fall back to a
  // `MouseEvent`-shaped stub only if the constructor is missing. Both
  // paths dispatch a real DOM event that bubbles through the
  // capture-phase listener the harness installed at boot.
  const PointerEventCtor =
    (globalThis as unknown as { PointerEvent?: typeof PointerEvent })
      .PointerEvent;
  if (typeof PointerEventCtor === "function") {
    const event = new PointerEventCtor("pointerdown", {
      pointerId,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    return;
  }
  // Fallback: synthesize a bubbling Event and pin `pointerId` on it —
  // matches what jsdom's `PointerEvent` polyfill would expose. Kept
  // small so it never diverges from the shipped shape.
  const fallback = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(fallback, "pointerId", { value: pointerId });
  el.dispatchEvent(fallback);
}

describe("Aftersign pointer-to-render latency harness contract", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;
    game?.input?.resetPointerToRenderLatency?.();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exposes the four probe methods on window.__game.input", () => {
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;

    expect(game).toBeDefined();
    expect(game?.input?.resetPointerToRenderLatency).toEqual(expect.any(Function));
    expect(game?.input?.markPointerIntent).toEqual(expect.any(Function));
    expect(game?.input?.markPointerRendered).toEqual(expect.any(Function));
    expect(game?.input?.getPointerToRenderLatencyReport).toEqual(expect.any(Function));
  });

  it("records a pointer intent from a real tap on a visible tap-choice element", () => {
    // Played-not-driven: mount a REAL tap surface, dispatch a REAL
    // `pointerdown` on it, and assert the harness's document-level
    // pointerdown listener captured the intent — without any
    // harness-side `markPointerIntent` call. This is the whole point
    // of the review: a contract nobody exercises through the DOM is
    // a contract on paper.
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;
    const button = mountTapChoice("packet");

    // Freeze the harness's clock so we can pin an exact deltaMs.
    // Boot uses `performance.now()`; pin it to a known value at the
    // moment of the tap, then advance it by 12ms before we close the
    // frame with a `markPointerRendered` call.
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(5_000);
    dispatchPointerdown(button, 42);

    // Render close-out — the served page drains pending intents right
    // after `composer.render()` on the next rAF tick. In jsdom we
    // don't have a compositor, so we call the same primitive at the
    // frame-arrival time (12ms later — well inside the 16.7ms budget).
    game?.input?.markPointerRendered?.({ renderedAtMs: 5_012, pointerId: 42 });

    const report = game?.input?.getPointerToRenderLatencyReport?.();
    expect(report?.samples).toHaveLength(1);
    expect(report?.latest).toMatchObject({
      pointerAtMs: 5_000,
      renderedAtMs: 5_012,
      deltaMs: 12,
      frameBudgetMs: 16.7,
      withinBudget: true,
    });
    expect(report?.worst?.deltaMs).toBe(12);
    expect(report?.worst?.withinBudget).toBe(true);
  });

  it("keeps the worst deltaMs across multiple taps so a regression stays loud", () => {
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;
    const button = mountTapChoice("acknowledge-kiosk");

    const nowSpy = vi.spyOn(performance, "now");

    // Tap #1: 8ms tap → inside budget.
    nowSpy.mockReturnValueOnce(1_000);
    dispatchPointerdown(button, 1);
    game?.input?.markPointerRendered?.({ renderedAtMs: 1_008, pointerId: 1 });

    // Tap #2: 20ms tap → OVER budget. This is the regression signal.
    nowSpy.mockReturnValueOnce(2_000);
    dispatchPointerdown(button, 2);
    game?.input?.markPointerRendered?.({ renderedAtMs: 2_020, pointerId: 2 });

    // Tap #3: 4ms tap — a good frame lands AFTER the bad one. The
    // report's `latest` reflects tap #3, but `worst` must still hold
    // tap #2 so the regression is visible.
    nowSpy.mockReturnValueOnce(3_000);
    dispatchPointerdown(button, 3);
    game?.input?.markPointerRendered?.({ renderedAtMs: 3_004, pointerId: 3 });

    const report = game?.input?.getPointerToRenderLatencyReport?.();
    expect(report?.samples).toHaveLength(3);
    expect(report?.latest).toMatchObject({ deltaMs: 4, withinBudget: true });
    expect(report?.worst).toMatchObject({
      deltaMs: 20,
      withinBudget: false,
    });
  });

  it("resets samples and pending intents so an isolated beat starts clean", () => {
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;
    const button = mountTapChoice("deliver-packet");

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(9_000);
    dispatchPointerdown(button, 7);
    game?.input?.markPointerRendered?.({ renderedAtMs: 9_010, pointerId: 7 });

    // Seed a pending intent that will NEVER close — after reset it
    // must be dropped, so a subsequent `markPointerRendered` for the
    // same pointerId does nothing rather than folding a stale sample.
    nowSpy.mockReturnValueOnce(9_500);
    dispatchPointerdown(button, 8);

    game?.input?.resetPointerToRenderLatency?.();

    // Pending intent for pointerId=8 is gone → this render signal is
    // orphaned and silently dropped.
    game?.input?.markPointerRendered?.({ renderedAtMs: 9_520, pointerId: 8 });

    const report = game?.input?.getPointerToRenderLatencyReport?.();
    expect(report?.samples).toEqual([]);
    expect(report?.latest).toBeUndefined();
    expect(report?.worst).toBeUndefined();
  });
});
