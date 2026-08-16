// Consumer test for the tap-choice feel wiring.
//
// `bootAftersignWindowGame` is the runtime consumer of
// `assertAftersignTapChoiceSurfaces` — this jsdom test mounts real
// `[data-aftersign-tap-choice]` elements with real bounding rects and
// asserts:
//   1. The harness's `getTapChoiceFeelReport()` measures every mounted
//      surface (surfaceCount, per-label results, ok flag).
//   2. A surface undersized on EITHER axis (width or height < 44px)
//      lands in `failures` with a labeled shortfall — that's what
//      makes the 44px minimum a runtime contract, not a synthetic-
//      object claim.
//   3. Adding / removing surfaces between calls yields a fresh report
//      — no stale measurement leaks across beats.
//
// jsdom NOTE: `Element.getBoundingClientRect()` returns a zero-sized
// DOMRect by default in jsdom, regardless of the element's inline
// style. Each test stubs the method per-element with the width/height
// we want to measure — that's the ground truth a real browser would
// hand back, and it's the only way to drive a rect-based assertion
// deterministically in unit-test land.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR,
  AFTERSIGN_TOUCH_FEEL,
} from "./tapChoiceFeel";
import "./harness/bootWindowGame";

function mountTapChoice(
  label: string,
  width: number,
  height: number,
): HTMLElement {
  const el = document.createElement("button");
  el.setAttribute("data-aftersign-tap-choice", label);
  // Stub the bounding rect. jsdom's default is 0x0 — we hand back the
  // dimensions the test claims the layout would produce so the
  // measurement is exercised end-to-end.
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.append(el);
  return el;
}

describe("tapChoiceFeel consumer (getTapChoiceFeelReport wiring)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("reports ok=true and zero surfaces when no tap choices are mounted", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const report = game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(true);
    expect(report?.surfaceCount).toBe(0);
    expect(report?.results).toEqual([]);
    expect(report?.failures).toEqual([]);
  });

  it("measures every mounted tap-choice surface and reports ok when all meet the minimum", () => {
    const min = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
    mountTapChoice("sealed", min, min);
    mountTapChoice("opened", min + 4, min + 8);
    mountTapChoice("ask-for-next-job", 60, 48);

    // Sanity — the selector really finds them in the live DOM.
    expect(
      document.querySelectorAll(AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR),
    ).toHaveLength(3);

    const report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(true);
    expect(report?.surfaceCount).toBe(3);
    expect(report?.failures).toEqual([]);

    // Labels flow through in document order — the report can name the
    // choices without a caller-side lookup.
    expect(report?.results.map((r) => r.label)).toEqual([
      "sealed",
      "opened",
      "ask-for-next-job",
    ]);
    // Each per-surface entry carries the raw dimensions AND the
    // resolved shortfall (0 when ok).
    expect(report?.results[0]).toMatchObject({
      label: "sealed",
      widthPx: min,
      heightPx: min,
      shortfallPx: 0,
      ok: true,
    });
  });

  it("flags a surface that is undersized on the width axis", () => {
    const min = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
    mountTapChoice("sealed", 40, min); // width short by 4
    mountTapChoice("opened", min, min);

    const report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(false);
    expect(report?.surfaceCount).toBe(2);
    expect(report?.failures).toHaveLength(1);

    const failure = report?.failures[0];
    expect(failure?.label).toBe("sealed");
    expect(failure?.widthPx).toBe(40);
    expect(failure?.heightPx).toBe(min);
    expect(failure?.shortfallPx).toBe(4);
    expect(failure?.minimumTargetPx).toBe(min);
  });

  it("flags a surface that is undersized on the height axis", () => {
    const min = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
    mountTapChoice("opened", 60, 32); // height short by 12

    const report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(false);
    expect(report?.failures).toHaveLength(1);
    expect(report?.failures[0]).toMatchObject({
      label: "opened",
      widthPx: 60,
      heightPx: 32,
      shortfallPx: 12,
      ok: false,
    });
  });

  it("returns a fresh measurement each call — a resize between beats is picked up", () => {
    const min = AFTERSIGN_TOUCH_FEEL.minimumTargetPx;
    const el = mountTapChoice("sealed", 40, min);

    let report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(false);
    expect(report?.failures[0]?.shortfallPx).toBe(4);

    // The renderer bumps the button to the minimum — the next report
    // must reflect that, not the stale first read.
    el.getBoundingClientRect = () =>
      ({
        width: min,
        height: min,
        top: 0,
        left: 0,
        right: min,
        bottom: min,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(true);
    expect(report?.failures).toEqual([]);
  });

  it("falls back to a positional label when data-aftersign-tap-choice is empty", () => {
    const el = document.createElement("button");
    el.setAttribute("data-aftersign-tap-choice", "");
    el.getBoundingClientRect = () =>
      ({
        width: 20,
        height: 20,
        top: 0,
        left: 0,
        right: 20,
        bottom: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.append(el);

    const report = window.__game?.getTapChoiceFeelReport();
    expect(report?.ok).toBe(false);
    expect(report?.failures).toHaveLength(1);
    // Fallback shape is "<tag>#<index>" — legible without knowing the
    // choice id.
    expect(report?.failures[0]?.label).toBe("button#0");
  });
});
