// Route-risk touch feedback — MAIN.JS-FACING WRAPPER.
//
// Soren's PR #1955 REQUEST_CHANGES: the previous draft was a pure
// module (`routeRiskTouchFeedback.ts`) returning `{ scale, translateY,
// durationMs }` that NOTHING imported. Zero consumers, zero shipped
// CSS reading its output, zero test driving a rendered outcome. Dead
// code on arrival — the "keeps a choice under the player's finger"
// narrative had no rendered effect.
//
// This is the fix, following the exact pattern of the sibling
// `aftersign/src/jobOfferChoiceFeedback.js`:
//
//   • `getRouteRiskTouchFeedback(routeRisk)` — pure resolver. Maps
//     the served vocabulary (`"low" | "medium" | "high"`) onto a
//     press envelope. Kept exported so a pure test can pin the axis
//     without a DOM.
//
//   • `applyRouteRiskTouchFeedback(button, routeRisk)` — DOM writer
//     that runs at click-time. Installs a scoped `<style>` on first
//     use, stamps `data-aftersign-route-risk-touch` + the shipped
//     `--aftersign-route-risk-touch-*` custom properties, and toggles
//     `.is-aftersign-route-risk-touch-pressing` for `durationMs`.
//     The installed CSS reads those attributes/vars — real rendered
//     transform, not an invented vocabulary with no consumer.
//
// The consumer test at
// `apps/web/src/aftersign/routeRiskTouchFeedback.consumer.test.ts`
// drives THIS module through jsdom and asserts the rendered outcome
// (installed <style>, stamped attribute, CSS vars, pressed-class
// round-trip on fake timers).

/**
 * The three axes below are the ONLY `routeRisk` values the served
 * offer surface ever emits (see
 * `packages/aftersign/src/computeOfferedJobs.ts::OFFER_BY_ID`).
 * Anything else collapses to `"low"`.
 *
 * Envelope numbers are tight on purpose: 96ms total press, ~2% scale
 * dip, 2px lift — under one animation frame's worth of overshoot so
 * the follow-up route transition never feels delayed. Riskier routes
 * get a marginally deeper press so the acknowledgement matches the
 * weight of the choice, but the deadline stays constant.
 */
export const AFTERSIGN_ROUTE_RISK_TOUCH_FEEL = Object.freeze({
  low: Object.freeze({
    pressScale: 0.982,
    liftPx: 2,
    durationMs: 96,
  }),
  medium: Object.freeze({
    pressScale: 0.974,
    liftPx: 2,
    durationMs: 96,
  }),
  high: Object.freeze({
    pressScale: 0.966,
    liftPx: 2,
    durationMs: 96,
  }),
});

export const AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS =
  "is-aftersign-route-risk-touch-pressing";

const STYLE_MARKER_ATTR = "data-aftersign-route-risk-touch-feel";

function normalizeRouteRisk(routeRisk) {
  if (routeRisk === "medium" || routeRisk === "high") return routeRisk;
  return "low";
}

/**
 * Pure resolver: `routeRisk` → the feel envelope the DOM writer will
 * stamp. Exposed so pure tests can pin the axis without a DOM.
 */
export function getRouteRiskTouchFeedback(routeRisk) {
  const key = normalizeRouteRisk(routeRisk);
  return { routeRisk: key, ...AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[key] };
}

/**
 * Install the scoped CSS block once per document. Idempotent: keyed
 * off `STYLE_MARKER_ATTR` on `<style>` in `<head>`, so repeat calls
 * don't accumulate style tags.
 *
 * The `[data-aftersign-route-risk-touch]` selector reads the three
 * `--aftersign-route-risk-touch-*` vars this module stamps, and the
 * `.is-aftersign-route-risk-touch-pressing` rule owns the pressed
 * transform outcome. Keeping the CSS colocated here means the
 * consumer test's jsdom assertions ARE the shipped surface — no
 * remote CSS file that can drift.
 */
export function installRouteRiskTouchFeedbackStyles(ownerDocument) {
  if (!ownerDocument || !ownerDocument.head) return;
  const existing = ownerDocument.head.querySelector(
    `style[${STYLE_MARKER_ATTR}="true"]`,
  );
  if (existing) return;

  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_MARKER_ATTR, "true");
  style.textContent = `
[data-aftersign-route-risk-touch] {
  transition:
    transform var(--aftersign-route-risk-touch-duration, 96ms) ease-out,
    box-shadow var(--aftersign-route-risk-touch-duration, 96ms) ease-out;
  will-change: transform;
}
[data-aftersign-route-risk-touch].${AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS} {
  transform:
    translateY(calc(var(--aftersign-route-risk-touch-lift, 2px) * -1))
    scale(var(--aftersign-route-risk-touch-press-scale, 0.98));
}
`;
  ownerDocument.head.appendChild(style);
}

/**
 * Apply the touch-feedback envelope to `button`. Runs at click-time
 * from the offer / route-risk callback in `aftersign/main.js` so the
 * acknowledgement lands on the exact rendered element the player
 * just tapped, in the same input frame.
 *
 * Effect on the DOM (all rendered, all testable):
 *
 *   1. `installRouteRiskTouchFeedbackStyles(ownerDocument)` mounts
 *      the scoped CSS block on first call (idempotent per document).
 *   2. Stamp `data-aftersign-route-risk-touch` + the three
 *      `--aftersign-route-risk-touch-*` custom properties. The
 *      installed rule then owns `transform` / `box-shadow`
 *      transitions off those vars.
 *   3. Toggle `AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS` on for
 *      `feel.durationMs`. The installed pressed rule reads
 *      `--aftersign-route-risk-touch-press-scale` +
 *      `--aftersign-route-risk-touch-lift` and applies the pressed
 *      transform — physical acknowledgement pinned to the exact
 *      button before route transition can defer the response.
 *
 * Returns the resolved feel envelope so main.js can pair the visual
 * with matched-duration audio/haptics; returns `null` if the button
 * handle is nullish (fail closed, not loud).
 */
export function applyRouteRiskTouchFeedback(button, routeRisk) {
  if (!button) return null;

  const key = normalizeRouteRisk(routeRisk);
  const feel = AFTERSIGN_ROUTE_RISK_TOUCH_FEEL[key];

  const ownerDocument =
    button.ownerDocument ||
    (typeof document !== "undefined" ? document : null);
  if (ownerDocument) {
    installRouteRiskTouchFeedbackStyles(ownerDocument);
  }

  button.setAttribute("data-aftersign-route-risk-touch", key);
  if (button.style && typeof button.style.setProperty === "function") {
    button.style.setProperty(
      "--aftersign-route-risk-touch-duration",
      `${feel.durationMs}ms`,
    );
    button.style.setProperty(
      "--aftersign-route-risk-touch-press-scale",
      String(feel.pressScale),
    );
    button.style.setProperty(
      "--aftersign-route-risk-touch-lift",
      `${feel.liftPx}px`,
    );
  }

  if (button.classList && typeof button.classList.add === "function") {
    button.classList.add(AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS);
    const clear = () => {
      button.classList.remove(AFTERSIGN_ROUTE_RISK_TOUCH_PRESSED_CLASS);
    };
    const scheduler =
      typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout
        : typeof setTimeout === "function"
          ? setTimeout
          : null;
    if (scheduler) {
      scheduler(clear, feel.durationMs);
    } else {
      // No timer host (SSR / bare Node): clear synchronously rather
      // than leak the pressed marker.
      clear();
    }
  }

  return { routeRisk: key, ...feel };
}
