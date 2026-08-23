// M-LOOP-E1: route + risk choice as a durable memory fact that feeds the
// next run's offered-action set.
//
// This module is the CONTRACT + the RENDERED CONSUMER for the loop:
//
//   1. Pure data + selection primitive
//        `computeOfferedActions(memory)` — what the next run offers,
//        keyed off `lastRoute` + `succeeded`.
//   2. Memory reducer
//        `recordRouteRun({ route, succeeded })` — pure function that
//        returns the memory fact a persistence layer should write.
//   3. DOM writer
//        `renderRouteRiskChoice(document, memory, onChoose)` — stamps
//        one `<button data-aftersign-tap-choice="<action>">` per
//        offered action into a `[data-aftersign-route-risk-surface]`
//        container. Wires each button's click to record the run and
//        re-render — so a real tap on the rendered UI updates the
//        memory AND diverges the offered-action set the next render
//        emits.
//
// Consumer contract:
//   - Every offered action gets a real, tappable, visible button on
//     the served DOM shape. The tap-choice attribute matches the
//     shipped `data-aftersign-tap-choice` vocabulary the served
//     surface already uses (see servedSurface.contract.test.ts), so
//     any harness that walks that selector picks these buttons up
//     without a fork.
//   - The sibling `routeRiskMemory.consumer.test.ts` drives a real
//     jsdom container, taps a button, and pins the divergence: a
//     "fast + succeeded" run offers a different set than a
//     "safe + failed" run.
//
// Shipped consumer:
//   `aftersign/index.html` hosts `<div id="routeRiskChoice"
//    data-aftersign-route-risk-surface>` inside the packet-choice
//   controls tray; `aftersign/main.js` imports `renderRouteRiskChoice`
//   + `computeOfferedActions` + `recordRouteRun`, restores
//   `state.player.routeRisk` from the durable save, exposes
//   `window.__game.renderRouteRiskChoice()` and
//   `window.__game.getOfferedActions()`, and re-renders the buttons
//   at every beat re-render + on each tap. The durable persist path
//   (`buildPersistPayload` in `aftersign/src/runtime/persistence.js`)
//   clones `state.player`, so the memory fact round-trips across
//   reload for free. The sibling `routeRiskMemory.consumer.test.ts`
//   drives the REAL served `aftersign/index.html` in jsdom and pins
//   both halves — DOM render + persist-payload round-trip — so a
//   refactor that unwires either half reds.

export type AftersignRoute = "fast" | "safe";

/** A durable fact from the player's most recent delivery run. */
export type AftersignRouteRiskMemory = {
  lastRoute: AftersignRoute;
  succeeded: boolean;
};

export type AftersignOfferedAction =
  | "take-the-shortcut"
  | "take-the-long-way"
  | "repair-the-loss"
  | "carry-a-fragile-packet";

/**
 * Select the next delivery's available actions from the persisted route fact.
 * A failed run foregrounds recovery; successful fast and safe runs leave
 * different work on the board.
 */
export function computeOfferedActions(
  memory: AftersignRouteRiskMemory | null | undefined,
): readonly AftersignOfferedAction[] {
  if (!memory || !memory.succeeded) {
    return ["repair-the-loss", "take-the-long-way"];
  }

  return memory.lastRoute === "fast"
    ? ["carry-a-fragile-packet", "take-the-long-way"]
    : ["take-the-shortcut", "carry-a-fragile-packet"];
}

/**
 * Reducer: turn a route + outcome into the memory fact to persist.
 * Pure — the caller owns where the fact is written.
 */
export function recordRouteRun(input: {
  route: AftersignRoute;
  succeeded: boolean;
}): AftersignRouteRiskMemory {
  return { lastRoute: input.route, succeeded: input.succeeded };
}

// DOM vocabulary — reuses the shipped `data-aftersign-tap-choice`
// attribute the served surface already stamps on every committing
// button. The container attribute is new but sits under the same
// `data-aftersign-*` namespace so a future served page can style
// it in one place.
export const AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE =
  "data-aftersign-route-risk-surface";
export const AFTERSIGN_ROUTE_RISK_SURFACE_SELECTOR =
  "[data-aftersign-route-risk-surface]";
export const AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE = "data-aftersign-tap-choice";

export type AftersignRouteRiskRenderInput = {
  /**
   * The container the writer stamps buttons into. A caller passes the
   * shipped `[data-aftersign-route-risk-surface]` node from the served
   * DOM; the writer replaces its children with one button per offered
   * action. Idempotent — calling the writer twice with the same memory
   * reproduces the same button set.
   */
  container: HTMLElement;
  memory: AftersignRouteRiskMemory | null | undefined;
  /**
   * Click handler for each offered action. Called with the action id
   * of the tapped button. Callers typically use this to update the
   * memory (via `recordRouteRun`) and re-render.
   */
  onChoose: (action: AftersignOfferedAction) => void;
  /**
   * Optional label mapper — a caller can pass authored copy for the
   * button label. Defaults to the action id, which is enough for the
   * tap-driven test and for scaffolding.
   */
  labelForAction?: (action: AftersignOfferedAction) => string;
};

/**
 * DOM writer — stamps one `<button data-aftersign-tap-choice="<action>">`
 * per offered action into the container and binds each button's click
 * to `onChoose(action)`. Returns the offered-action set it rendered so
 * a caller can log or assert against it without re-computing.
 *
 * Contract:
 *   - Idempotent: two calls with the same `memory` render the same
 *     buttons in the same order.
 *   - Each rendered button is a real `<button type="button">` element
 *     with the shipped `data-aftersign-tap-choice` attribute — a tap
 *     harness that already walks `AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR`
 *     picks these up.
 *   - `onChoose` fires on `click`, so a jsdom `.click()` drives it.
 */
export function renderRouteRiskChoice(
  input: AftersignRouteRiskRenderInput,
): readonly AftersignOfferedAction[] {
  const { container, memory, onChoose, labelForAction } = input;
  const actions = computeOfferedActions(memory);
  container.setAttribute(AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE, "");
  // Clear any previous render (idempotency).
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  const doc = container.ownerDocument;
  for (const action of actions) {
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute(AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE, action);
    button.textContent = labelForAction ? labelForAction(action) : action;
    button.addEventListener("click", () => {
      onChoose(action);
    });
    container.appendChild(button);
  }
  return actions;
}
