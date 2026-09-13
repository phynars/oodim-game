// Consumer wiring test for `routeRiskActionLabels.js`.
//
// Purpose (Soren's REQUEST_CHANGES on #1747):
//   The prior draft added a label map with zero importers. This
//   test proves two things:
//
//     1. The module is CONSUMED by the served renderer contract:
//        `renderRouteRiskChoice({ labelForAction: routeRiskActionLabel,
//        ... })` produces buttons whose visible `textContent` is the
//        authored label, not the raw action id.
//
//     2. The two route strings are NOT a third parallel vocabulary:
//        `routeRiskActionLabel("take-the-long-way")` is byte-identical
//        to `AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel`, and
//        the shortcut label matches `.riskyRouteLabel`. If a future
//        edit drifts one string away from the authored copy, this
//        red-lines.

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
import {
  ROUTE_RISK_ACTION_LABELS,
  routeRiskActionLabel,
} from "./routeRiskActionLabels.js";
import {
  computeOfferedActions,
  renderRouteRiskChoice,
} from "./routeRiskMemory";

describe("routeRiskActionLabels — source-of-truth invariant", () => {
  it("re-uses the authored `safeRouteLabel` string verbatim for `take-the-long-way`", () => {
    expect(routeRiskActionLabel("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel,
    );
  });

  it("re-uses the authored `riskyRouteLabel` string verbatim for `take-the-shortcut`", () => {
    expect(routeRiskActionLabel("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.riskyRouteLabel,
    );
  });

  it("covers every action id `computeOfferedActions` can emit — no raw ids reach the DOM", () => {
    // Union of every action set the primitive can return for every
    // reachable memory state (null / failed / fast+succeeded /
    // safe+succeeded). If a future action id is added to the writer
    // without a matching label row, this red-lines.
    const memories = [
      null,
      { lastRoute: "safe", succeeded: false },
      { lastRoute: "fast", succeeded: true },
      { lastRoute: "safe", succeeded: true },
    ] as const;
    const emitted = new Set<string>();
    for (const memory of memories) {
      for (const action of computeOfferedActions(memory)) {
        emitted.add(action);
      }
    }
    for (const action of emitted) {
      expect(ROUTE_RISK_ACTION_LABELS).toHaveProperty(action);
      const label = routeRiskActionLabel(action);
      expect(label.length).toBeGreaterThan(0);
      // No raw action id leaks into the rendered label — a label
      // must never equal the action id it labels.
      expect(label).not.toBe(action);
    }
  });

  it("falls back to a safe generic prompt for unknown ids (no raw id ever renders)", () => {
    // A future action added to `computeOfferedActions` without a
    // label row still renders a sensible button rather than the
    // raw id.
    expect(routeRiskActionLabel("no-such-action")).toBe("Choose a route");
  });
});

describe("routeRiskActionLabels — served renderer wiring", () => {
  it("stamps the authored label onto every rendered button when passed as `labelForAction`", () => {
    const dom = new JSDOM("<!doctype html><div id='surface'></div>");
    const container = dom.window.document.getElementById(
      "surface",
    ) as unknown as HTMLElement;

    renderRouteRiskChoice({
      container,
      memory: null, // failed / cold → ["repair-the-loss", "take-the-long-way"]
      labelForAction: routeRiskActionLabel,
      onChoose: () => {},
    });

    const buttons = Array.from(
      container.querySelectorAll("button[data-aftersign-tap-choice]"),
    ) as HTMLElement[];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      const action = button.getAttribute("data-aftersign-tap-choice") ?? "";
      // Visible text is the authored label, not the raw id.
      expect(button.textContent).toBe(routeRiskActionLabel(action));
      expect(button.textContent).not.toBe(action);
    }

    // Specifically: the "take-the-long-way" button renders the
    // authored `safeRouteLabel` from the job-offer copy — proving
    // there is ONE vocabulary, not two.
    const longWay = buttons.find(
      (b) => b.getAttribute("data-aftersign-tap-choice") === "take-the-long-way",
    );
    expect(longWay?.textContent).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel,
    );
  });
});
