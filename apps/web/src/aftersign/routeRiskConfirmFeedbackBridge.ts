// Bridge: wire the shipped route-risk press envelope
// (`aftersign/src/routeRiskConfirmFeedback.js`) THROUGH the
// `renderRouteRiskChoice` writer's click handler without dragging a
// browser-only `window.matchMedia` / `Element.animate` import into
// the pure lane (`routeRiskMemory.ts` is imported by the plain-Node
// pure-runner — see the header at
// `apps/web/src/aftersign/routeRiskMemory.ts:50-62`).
//
// The bridge is a THIN adapter: it takes an existing `onChoose`
// callback and returns a wrapped callback that plays the confirmation
// envelope on the container *before* delegating to the underlying
// `onChoose`. The feedback module owns the reduced-motion branch, the
// try/catch discipline, and the boolean return contract; this bridge
// only owns the "which surface do we play on" question.
//
// Consumer expectation:
//   - `aftersign/main.js` imports `wrapRouteRiskChoiceOnChoose` and
//     wraps the two `onChoose` callbacks it passes into
//     `renderRouteRiskChoice({...})` at the packet-choice beat AND
//     at the `window.__game.renderRouteRiskChoice()` seam. The
//     played surface is the shipped `#routeRiskChoice` tray (the
//     container the writer stamped the tapped button into) —
//     matching the JSDoc on `playRouteRiskConfirmFeedback`
//     ("the tray the player just used").
//   - Sibling `routeRiskConfirmFeedbackBridge.consumer.test.ts` (this
//     PR) drives the served `renderRouteRiskChoice` writer against a
//     real jsdom container with the bridge wired, taps a button, and
//     pins that the played animation lands on the container — so a
//     future refactor that unwires the bridge reds on the served
//     render path, not a jsdom-only fixture.
//
// Contract-preservation:
//   - Delegation is unconditional. `wrapRouteRiskChoiceOnChoose` MUST
//     forward every accepted tap to the underlying `onChoose` — the
//     durable route commit cannot depend on the decorative feedback.
//   - Feedback is played BEFORE delegation. The `.animate(...)` call
//     inside `playRouteRiskConfirmFeedback` starts the WAAPI animation
//     synchronously; if the delegate re-renders the tray and cancels
//     the animation, the KeyframeEffect has already been created and
//     any monkey-patched `Element.prototype.animate` recorder in a
//     Playwright initScript has already observed the call. That's the
//     capture discipline the e2e
//     `aftersign-route-risk-confirm-feedback.playtest.spec.ts` relies
//     on to survive the tap-driven tray reflow.
//   - If `container` is null/undefined the wrapper still delegates —
//     never swallow a durable commit because we lack a decorative
//     surface.

import type { AftersignOfferedAction } from "./routeRiskMemory.ts";

/**
 * The `playRouteRiskConfirmFeedback` shape the served
 * `aftersign/src/routeRiskConfirmFeedback.js` module exports. Typed
 * as a contract so the bridge does not import the browser-only
 * module directly at type-check time — the shipped consumer
 * (`aftersign/main.js`) supplies the real function.
 */
export type PlayRouteRiskConfirmFeedback = (
  surface: HTMLElement | null | undefined,
) => boolean;

export type WrapRouteRiskChoiceOnChooseInput = {
  /** The `[data-aftersign-route-risk-surface]` container the writer stamped buttons into. */
  container: HTMLElement | null | undefined;
  /** Underlying commit callback the served `main.js` supplies (route memory + advance). */
  onChoose: (action: AftersignOfferedAction) => void;
  /** The shipped `playRouteRiskConfirmFeedback` from `aftersign/src/routeRiskConfirmFeedback.js`. */
  playFeedback: PlayRouteRiskConfirmFeedback;
};

/**
 * Wrap a `renderRouteRiskChoice` `onChoose` callback so every accepted
 * route-risk tap first plays the shipped confirmation envelope on the
 * tray, then delegates to the underlying commit. See file header for
 * the contract.
 */
export function wrapRouteRiskChoiceOnChoose(
  input: WrapRouteRiskChoiceOnChooseInput,
): (action: AftersignOfferedAction) => void {
  const { container, onChoose, playFeedback } = input;
  return (action) => {
    try {
      playFeedback(container ?? null);
    } catch {
      // Decorative feedback must never interrupt the durable route
      // commit. The feedback module already wraps its own animation
      // path in try/catch; this outer guard is defense-in-depth
      // against a caller supplying a `playFeedback` that throws
      // synchronously outside the animation path.
    }
    onChoose(action);
  };
}
