// Press feedback for the job-take button (#1681 / #1663 / PR #1649).
//
// Contract: from the moment `pointerdown` lands, the button MUST be
// visibly compressed for the full hold window regardless of how long
// the finger stays down. Playwright's `touchscreen.tap()` dispatches
// pointerdown+pointerup in ~1ms, so anything keyed on contact duration
// (`:active`, restore-on-pointerup) leaves the canonical 64ms sample
// at ~identity scale. This handler therefore:
//
//   1. stamps `data-aftersign-job-take="pressing"` so the CSS envelope
//      keys on it (same marker the inline index.html handler uses);
//   2. writes an INLINE `transform: scale(scaleFrom)` with
//      `transition: none` so the compression is painted on the very
//      next frame — not mid-transition at 64ms (the base rule
//      transitions `transform` over `--aftersign-job-take-hold-ms`,
//      which is the RELEASE duration, not the press-in duration);
//   3. holds for `holdMs` from POINTERDOWN (not pointerup), and only
//      restores the marker if it is still `pressing` — a mid-hold
//      ready→armed rewrite by main.js wins over our restore.
//
// `pointercancel` / `lostpointercapture` no longer restore instantly:
// a touch pointerdown followed by the browser claiming the gesture
// would otherwise erase the envelope before it's ever sampled. They
// fall through to the same hold timer.

const DEFAULT_HOLD_MS = 96;
const DEFAULT_SCALE_FROM = 0.97;

const readHoldMs = (element) => {
  try {
    const raw = getComputedStyle(element).getPropertyValue(
      "--aftersign-job-take-hold-ms",
    );
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HOLD_MS;
  } catch {
    return DEFAULT_HOLD_MS;
  }
};

export const attachJobOfferPressFeedback = (element, scaleFrom, holdMs) => {
  if (!element || typeof element.addEventListener !== "function") return;
  if (element.__aftersignPressFeedbackAttached) return;
  element.__aftersignPressFeedbackAttached = true;

  const pressedScale = Number.isFinite(scaleFrom) ? scaleFrom : DEFAULT_SCALE_FROM;
  let restoreTimer = null;
  let priorMarker = null;

  const restore = () => {
    restoreTimer = null;
    element.style.transform = "";
    element.style.transition = "";
    if (element.getAttribute("data-aftersign-job-take") === "pressing") {
      if (priorMarker === null) {
        element.removeAttribute("data-aftersign-job-take");
      } else {
        element.setAttribute("data-aftersign-job-take", priorMarker);
      }
    }
    priorMarker = null;
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (restoreTimer !== null) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    } else {
      priorMarker = element.getAttribute("data-aftersign-job-take");
    }
    if (priorMarker === "pressing") priorMarker = "ready";
    element.setAttribute("data-aftersign-job-take", "pressing");
    element.style.transition = "none";
    element.style.transform = `scale(${pressedScale})`;
    const hold = Number.isFinite(holdMs) && holdMs > 0 ? holdMs : readHoldMs(element);
    restoreTimer = setTimeout(restore, hold);
  });
};
