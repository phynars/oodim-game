// Consumer test for `aftersign/src/routeRiskTouchFeedback.js` — the
// main.js-facing wrapper that acknowledges a route-risk choice tap on
// the exact rendered button.
//
// This test is the trip-wire Soren's PR #1955 REQUEST_CHANGES demanded:
//
//   1. RENDERED outcome — the previous draft (`routeRiskTouchFeedback
//      .ts`) exposed only a pure resolver `getRouteRiskTouchFeedback`
//      returning `{ scale, translateY, durationMs }`. Nothing imported
//      it, no shipped CSS read its output. Dead on arrival.
//
//   2. This file asserts the DOM-writer half — that the wrapper
//      installs the scoped `<style>`, stamps `data-aftersign-route-
//      risk-touch` + the shipped `--aftersign-route-risk-touch-*`
//      custom properties the installed CSS reads, and toggles
//      `.is-aftersign-route-risk-touch-pressing` for the pressed
//      transform outcome.
//
// Scope guard: numbers (durationMs / pressScale / liftPx) are pinned
// against the shipped `AFTERSIGN_ROUTE_RISK_TOUCH_FEEL` table imported
// from the same module — this test asserts EQUALITY against the
// shipped envelope, so drift reds here.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AFTERSIGN_ROUTE_RISK_TOUCH_FEEL,
  AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS,
  applyRouteRiskTouchFeedback,
  getRouteRiskTouchFeedback,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — plain-JS sibling module, no .d.ts
} from "../../../../aftersign/src/routeRiskTouchFeedback.js";

// jsdom returns custom-property values with a leading space — trim
// every read (same pattern as jobOfferChoiceFeedback.consumer.test.ts).
const cssVar = (el: HTMLElement, name: string): string =>
  el.style.getPropertyValue(name).trim();

// The three axes below are the ONLY `routeRisk` values that reach the
// route-risk touch surface. Testing the wrapper with the CALL SITE's
// actual vocabulary is what pins the contract.
const ROUTE_RISK_KEYS = ["low", "medium", "high"] as const;

describe("routeRiskTouchFeedback (main.js consumer)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head
      .querySelectorAll('style[data-aftersign-route-risk-touch-feel="true"]')
      .forEach((node) => node.remove());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  describe("getRouteRiskTouchFeedback (pure resolver)", () => {
    for (const routeRisk of ROUTE_RISK_KEYS) {
      it(`returns the ${routeRisk} envelope for routeRisk=${routeRisk}`, () => {
        const feedback = getRouteRiskTouchFeedback(routeRisk);
        expect(feedback.routeRisk).toBe(routeRisk);
        expect(feedback.durationMs).toBe(
          AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[routeRisk].durationMs,
        );
        expect(feedback.pressScale).toBe(
          AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[routeRisk].pressScale,
        );
        expect(feedback.liftPx).toBe(
          AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[routeRisk].liftPx,
        );
      });
    }

    it("collapses an unknown routeRisk to the low envelope, not a stronger tone", () => {
      const feedback = getRouteRiskTouchFeedback("unknown");
      expect(feedback.routeRisk).toBe("low");
      expect(feedback.pressScale).toBe(
        AFTERSIGN_ROUTE_RISK_TOUCH_FEEL.low.pressScale,
      );
    });

    it("holds the deadline constant across risk axes so route transition never feels delayed", () => {
      // The whole point of the feel fix — press dip scales with risk
      // weight, but the acknowledgement's DURATION doesn't. If a
      // future tune shifts `high.durationMs` above `low.durationMs`
      // the follow-up transition will queue behind a longer press
      // and the touch will feel sticky. Reds here.
      const durations = ROUTE_RISK_KEYS.map(
        (k) => AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[k].durationMs,
      );
      expect(new Set(durations).size).toBe(1);
    });
  });

  describe("applyRouteRiskTouchFeedback (rendered outcome)", () => {
    it("installs the scoped CSS block on first call (idempotent across calls)", () => {
      const button = document.createElement("button");
      document.body.append(button);

      applyRouteRiskTouchFeedback(button, "low");
      applyRouteRiskTouchFeedback(button, "medium");
      applyRouteRiskTouchFeedback(button, "high");

      const styles = document.head.querySelectorAll(
        'style[data-aftersign-route-risk-touch-feel="true"]',
      );
      expect(styles).toHaveLength(1);
      // The installed CSS references the vars the wrapper stamps —
      // this is what makes the applied half a rendered outcome, not
      // an invented vocabulary with no consumer.
      expect(styles[0]!.textContent).toContain(
        "--aftersign-route-risk-touch-press-scale",
      );
      expect(styles[0]!.textContent).toContain(
        "--aftersign-route-risk-touch-lift",
      );
      expect(styles[0]!.textContent).toContain(
        "--aftersign-route-risk-touch-duration",
      );
      expect(styles[0]!.textContent).toContain(
        AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS,
      );
      expect(styles[0]!.textContent).toContain(
        "[data-aftersign-route-risk-touch]",
      );
    });

    for (const routeRisk of ROUTE_RISK_KEYS) {
      it(`stamps data-aftersign-route-risk-touch="${routeRisk}" and the shipped CSS vars`, () => {
        const button = document.createElement("button");
        document.body.append(button);

        applyRouteRiskTouchFeedback(button, routeRisk);

        expect(button.getAttribute("data-aftersign-route-risk-touch")).toBe(
          routeRisk,
        );

        const feel = AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[routeRisk];
        expect(cssVar(button, "--aftersign-route-risk-touch-duration")).toBe(
          `${feel.durationMs}ms`,
        );
        expect(cssVar(button, "--aftersign-route-risk-touch-press-scale")).toBe(
          String(feel.pressScale),
        );
        expect(cssVar(button, "--aftersign-route-risk-touch-lift")).toBe(
          `${feel.liftPx}px`,
        );
      });
    }

    it("toggles the pressed class ON immediately and OFF after durationMs", () => {
      const button = document.createElement("button");
      document.body.append(button);

      applyRouteRiskTouchFeedback(button, "medium");

      // On immediately — the acknowledgement lands in the same input
      // frame the player's tap resolves.
      expect(
        button.classList.contains(AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS),
      ).toBe(true);

      const medium = AFTERSIGN_ROUTE_RISK_TOUCH_FEEL.medium;
      vi.advanceTimersByTime(medium.durationMs - 1);
      expect(
        button.classList.contains(AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS),
      ).toBe(true);

      vi.advanceTimersByTime(2);
      expect(
        button.classList.contains(AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS),
      ).toBe(false);
    });

    it("returns null and does nothing when button is nullish", () => {
      // Defensive path — a future refactor could pass a GC'd handle.
      // Fail closed, not loud.
      expect(applyRouteRiskTouchFeedback(null, "low")).toBeNull();
      expect(applyRouteRiskTouchFeedback(undefined, "low")).toBeNull();
    });

    it("returns the resolved feel envelope so the caller can pair audio/haptics", () => {
      const button = document.createElement("button");
      document.body.append(button);

      const result = applyRouteRiskTouchFeedback(button, "high");
      expect(result).not.toBeNull();
      expect(result!.routeRisk).toBe("high");
      expect(result!.durationMs).toBe(
        AFTERSIGN_ROUTE_RISK_TOUCH_FEEL.high.durationMs,
      );
      expect(result!.pressScale).toBe(
        AFTERSIGN_ROUTE_RISK_TOUCH_FEEL.high.pressScale,
      );
    });
  });
});
