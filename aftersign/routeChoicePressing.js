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
// in `index.html`) paints the compressed + sunk transform for the
// full hold window — a press-juice probe or a real player's eye
// lands INSIDE the compressed envelope regardless of finger contact
// duration.
//
// SOURCE OF TRUTH — the four numeric constants (scale 0.972, lift 1px,
// hold-ms 96, easing cubic-bezier(.2,.8,.2,1)) live in ONE place:
// the :root CSS variables authored on `#aftersign/index.html`.
// `routeChoicePressFeedback.ts` mirrors those numbers and its
// pure-runner-registered served contract check reds the CI lane if the
// CSS values drift. This module reads the computed values and only
// carries defensive fallbacks.

const FALLBACK_HOLD_MS = 96;
const FALLBACK_SCALE = 0.972;
const FALLBACK_LIFT_PX = 1;
const ROUTE_CHOICE_BUTTON_SELECTOR =
  "#routeChoice button#acknowledgeRouteButton, #routeChoice button#skipRouteButton";
const attachedButtons = new WeakSet();

function resolvePositiveNumber(button, propertyName, fallback) {
  const raw = getComputedStyle(button).getPropertyValue(propertyName).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveHoldMs(button) {
  return resolvePositiveNumber(
    button,
    "--aftersign-route-choice-press-hold-ms",
    FALLBACK_HOLD_MS,
  );
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function stampPressedTransform(button) {
  // The class rule is the ordinary paint path. This inline stamp is its
  // belt-and-suspenders counterpart: a one-tap commit can synchronously
  // change dialogue visibility, so writing the resolved transform before
  // that work ensures the player gets one settled compression frame.
  if (prefersReducedMotion()) return;
  const scale = resolvePositiveNumber(
    button,
    "--aftersign-route-choice-press-scale-from",
    FALLBACK_SCALE,
  );
  const liftPx = resolvePositiveNumber(
    button,
    "--aftersign-route-choice-press-lift-px",
    FALLBACK_LIFT_PX,
  );
  button.style.transform = `translateY(${liftPx}px) scale(${scale})`;
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
  stampPressedTransform(button);

  window.setTimeout(() => {
    // Only clear if we're still the ones holding the marker. A future
    // handler that stamps a different value inside the hold window
    // should not be clobbered on restore.
    if (
      button.getAttribute("data-aftersign-route-choice-press") === "pressing"
    ) {
      button.removeAttribute("data-aftersign-route-choice-press");
    }
    // Hand the release back to the authored CSS transition. This must
    // happen after marker removal so the return path eases from the
    // actual pressed geometry rather than snapping to identity.
    button.style.transform = "";
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
