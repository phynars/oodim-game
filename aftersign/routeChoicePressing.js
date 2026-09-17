// Canonical route-choice press owner for the served AFTERSIGN surface.
//
// Sibling of `jobOfferPressing.js` and `packetOfferPressing.js`. The
// played surface at the packet-choice beat is `#routeChoice`
// (`aftersign/index.html:1002`), which hosts two committing buttons —
// `#acknowledgeRouteButton` ("I listened") and `#skipRouteButton`
// ("I ran early"). Both are one-tap forks: pointerdown fires and the
// touch is released before `:active` can drive a paintable
// compression (Playwright's `touchscreen.tap()` dispatches
// touchstart+touchend in ~1ms; real fingers aren't much slower on a
// one-tap commit).
//
// This module owns the press envelope. On pointerdown we stamp
// `data-aftersign-route-choice-press="pressing"` on the tapped button
// and schedule a restore via `setTimeout(hold-ms)` so the CSS rule
// for the pressing marker
// (see `#routeChoice button[data-aftersign-route-choice-press="pressing"]`
// in `index.html`) paints the compressed + lifted transform for the
// full hold window — a press-juice probe or a real player's eye
// lands INSIDE the compressed envelope regardless of finger contact
// duration.
//
// SOURCE OF TRUTH — the four numeric constants (scale 0.972, lift 1px,
// hold-ms 96, easing cubic-bezier(.2,.8,.2,1)) live in ONE place:
// the :root CSS variables authored on `#aftersign/index.html`
// (--aftersign-route-choice-press-*). The typed contract module
// `aftersign/src/routeChoicePressFeedback.ts` mirrors those numbers
// (ROUTE_CHOICE_PRESS_SCALE, ROUTE_CHOICE_PRESS_LIFT_PX,
// ROUTE_CHOICE_PRESS_OUT_MS) and its pure-runner-registered check
// (`runRouteChoicePressFeedbackChecks`, wired in
// `aftersign/pure-runner.ts`) reds the CI lane if the TS constants
// drift from the shipped CSS values. This file inlines only the
// FALLBACK (used if the CSS var is missing / unparseable) and reads
// the hold-ms from getComputedStyle so an edit to the :root var
// re-times the shipped surface without touching this file.
//
// Prior-value restore: the two route-choice buttons carry a
// `data-aftersign-tap-choice` attribute but no per-button state
// stored on `data-aftersign-route-choice-press` — the marker exists
// ONLY for the press window, then is removed. This mirrors
// packetOfferPressing.js's absence-is-the-prior discipline.
//
// Same-id replacement: `#acknowledgeRouteButton` and
// `#skipRouteButton` are fixed elements in `index.html` (not
// re-rendered under a parent tray the way job offers are), so no
// inFlight map is needed. A future refactor that re-renders them
// should mirror `jobOfferPressing.js`'s WeakSet + MutationObserver
// hook.

const FALLBACK_HOLD_MS = 96;
const ROUTE_CHOICE_BUTTON_SELECTOR =
  "#routeChoice button#acknowledgeRouteButton, #routeChoice button#skipRouteButton";
const attachedButtons = new WeakSet();

function resolveHoldMs(button) {
  // Read from the computed CSS (--aftersign-route-choice-press-hold-ms
  // is authored on :root in index.html). getPropertyValue on inline
  // style returns "" for :root vars; use getComputedStyle so the
  // cascade resolves it. Same shape as packetOfferPressing.js.
  const raw = getComputedStyle(button)
    .getPropertyValue("--aftersign-route-choice-press-hold-ms")
    .trim();
  const holdMs = Number.parseFloat(raw);
  return Number.isFinite(holdMs) && holdMs > 0 ? holdMs : FALLBACK_HOLD_MS;
}

function armPressing(button) {
  // Guard: don't re-arm inside an existing hold — the outstanding
  // setTimeout will still restore at its original deadline, so a
  // second pointerdown mid-hold would either double-stack the marker
  // or race the restore. Single press-per-hold is the intended shape.
  if (button.getAttribute("data-aftersign-route-choice-press") === "pressing") {
    return;
  }

  const holdMs = resolveHoldMs(button);
  button.setAttribute("data-aftersign-route-choice-press", "pressing");

  window.setTimeout(() => {
    // Only clear if we're still the ones holding the marker. A future
    // handler that stamps a different value inside the hold window
    // should not be clobbered on restore.
    if (
      button.getAttribute("data-aftersign-route-choice-press") === "pressing"
    ) {
      button.removeAttribute("data-aftersign-route-choice-press");
    }
  }, holdMs);
}

/** Attach the canonical route-choice press marker to one button. */
export function attachRouteChoicePressing(button) {
  if (!(button instanceof HTMLButtonElement) || attachedButtons.has(button)) {
    return;
  }
  attachedButtons.add(button);
  button.addEventListener("pointerdown", () => armPressing(button), {
    passive: true,
  });
}

function attachMounted(root = document) {
  root
    .querySelectorAll(ROUTE_CHOICE_BUTTON_SELECTOR)
    .forEach(attachRouteChoicePressing);
}

// The two route-choice buttons ship in the initial HTML, so they're
// typically already mounted by the time this module executes. Attach
// immediately, and also re-attempt after DOMContentLoaded in case
// module ordering ever changes. A MutationObserver keeps future
// injected surfaces covered (mirrors jobOfferPressing.js).
attachMounted();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => attachMounted(), {
    once: true,
  });
}
new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (
        node.matches &&
        node.matches(ROUTE_CHOICE_BUTTON_SELECTOR)
      ) {
        attachRouteChoicePressing(node);
      }
      if (node.querySelectorAll) attachMounted(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
