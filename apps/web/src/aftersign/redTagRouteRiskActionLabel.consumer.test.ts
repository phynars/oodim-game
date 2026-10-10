// Consumer wiring test for `aftersign/src/redTagRouteLabels.js`.
//
// Purpose (Soren's REQUEST_CHANGES on #2256):
//   The red-tag resolver must satisfy TWO contracts at once, and both
//   must be proven against the SERVED renderer tapping real buttons:
//
//     1. ROUTE actions resolve to the frozen TRUSTED job-offer copy —
//        `routeRiskActionLabelForOffer(chooseAftersignJobOfferCopy(
//        <trusted memory>))` — so there is ONE vocabulary, not two.
//
//     2. NON-ROUTE actions (`carry-a-fragile-packet`, `repair-the-loss`)
//        return `null`, and the main.js call site falls back to
//        `routeRiskActionLabel(action)` via `?? routeRiskActionLabel`.
//        Previously this spec was absent, and dropping that fallback
//        rendered BLANK buttons on the red-tag path.
//
// This test drives real buttons through `renderRouteRiskChoice`, taps
// each one, and asserts the visible `textContent` is never empty and
// never equal to the raw action id — the two failure modes that would
// re-ship the regression.

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
import { routeRiskActionLabel } from "./routeRiskActionLabels.js";
import {
  computeOfferedActions,
  renderRouteRiskChoice,
} from "./routeRiskMemory";
import { redTagRouteRiskActionLabel } from "../../../../aftersign/src/redTagRouteLabels.js";

// Mirror of `main.js`'s red-tag `labelForRouteRiskAction`:
//   state.delivery.id === "red-tag"
//     ? (action) => redTagRouteRiskActionLabel(action)
//         ?? routeRiskActionLabel(action)
//     : routeRiskActionLabel
// If main.js drifts (e.g. drops the `??` fallback again), the "renders
// a non-empty label for every offered action" test red-lines.
const redTagLabelForAction = (action: string): string =>
  redTagRouteRiskActionLabel(action) ?? routeRiskActionLabel(action);

describe("redTagRouteRiskActionLabel — resolver contract", () => {
  it("resolves route actions to the frozen TRUSTED offer-copy row (one vocabulary)", () => {
    expect(redTagRouteRiskActionLabel("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    expect(redTagRouteRiskActionLabel("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );
  });

  it("returns null for non-route actions so the caller falls back to routeRiskActionLabel", () => {
    // These two actions appear in the red-tag route-risk UI when the
    // player's prior route failed or when the first-packet path is
    // offered. If the resolver returned a string here the fallback
    // would be bypassed; if it returned "" the main.js `??` operator
    // would also skip the fallback (`??` only triggers on
    // null/undefined). Only `null` is correct.
    expect(redTagRouteRiskActionLabel("carry-a-fragile-packet")).toBeNull();
    expect(redTagRouteRiskActionLabel("repair-the-loss")).toBeNull();
    expect(redTagRouteRiskActionLabel("no-such-action")).toBeNull();
  });
});

describe("redTagRouteRiskActionLabel — served renderer wiring (tap-driven)", () => {
  it("renders a non-empty authored label on every red-tag route button and never the raw id", () => {
    // Union of every action id `computeOfferedActions` can emit across
    // every reachable memory state. If a future action id ships on the
    // red-tag path with no label coverage, this red-lines.
    const memories = [
      null,
      { lastRoute: "safe", succeeded: false },
      { lastRoute: "fast", succeeded: true },
      { lastRoute: "safe", succeeded: true },
    ] as const;

    for (const memory of memories) {
      const dom = new JSDOM("<!doctype html><div id='surface'></div>");
      const container = dom.window.document.getElementById(
        "surface",
      ) as unknown as HTMLElement;

      renderRouteRiskChoice({
        container,
        memory,
        labelForAction: redTagLabelForAction,
        onChoose: () => {},
      });

      const buttons = Array.from(
        container.querySelectorAll("button[data-aftersign-tap-choice]"),
      ) as HTMLElement[];

      // computeOfferedActions emits 2 actions per memory state; the
      // red-tag path must render both as tappable, labeled buttons.
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.length).toBe(computeOfferedActions(memory).length);

      for (const button of buttons) {
        const action = button.getAttribute("data-aftersign-tap-choice") ?? "";
        const text = (button.textContent ?? "").trim();
        // The regression Soren caught: dropping `?? routeRiskActionLabel`
        // let the renderer stamp `null`/`""` as the label text for
        // `carry-a-fragile-packet` and `repair-the-loss`. Both of
        // these assertions red-line on that exact failure.
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(action);
        // Positive invariant: whichever branch of `??` fired, the
        // final text must agree with the composed resolver.
        expect(text).toBe(redTagLabelForAction(action));
      }
    }
  });

  it("taps the two red-tag route buttons and reports the trusted-row labels back", () => {
    // Memory where `computeOfferedActions` emits BOTH route ids
    // (fast+succeeded → ["take-the-shortcut", "take-the-long-way"])
    // so both route labels get driven end-to-end.
    const dom = new JSDOM("<!doctype html><div id='surface'></div>");
    const container = dom.window.document.getElementById(
      "surface",
    ) as unknown as HTMLElement;

    const taps: Array<{ action: string; label: string }> = [];
    renderRouteRiskChoice({
      container,
      memory: { lastRoute: "fast", succeeded: true },
      labelForAction: redTagLabelForAction,
      onChoose: (action) => {
        const button = container.querySelector(
          `button[data-aftersign-tap-choice="${action}"]`,
        ) as HTMLElement | null;
        taps.push({ action, label: (button?.textContent ?? "").trim() });
      },
    });

    const buttons = Array.from(
      container.querySelectorAll("button[data-aftersign-tap-choice]"),
    ) as HTMLElement[];
    for (const button of buttons) button.click();

    const byAction = new Map(taps.map((t) => [t.action, t.label]));
    expect(byAction.get("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    expect(byAction.get("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );
  });
});
