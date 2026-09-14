// Canonical packet-offer press owner for the visible AFTERSIGN kiosk surface.
//
// Sibling of `jobOfferPressing.js`. The played surface at the packet-offered
// beat is `#packetButton` — a fixed <button> in `aftersign/index.html`. The
// sibling `.packet-button:active span` rule only scales the <span> child by
// 1% for ~1ms under Playwright's `touchscreen.tap()`, which the press-juice
// spec (`aftersign-packet-offer-press-juice.playtest.spec.ts`) cannot
// measure — it samples the BUTTON's bounding rect and needs the button
// ITSELF to compress for a real painted window.
//
// This module owns that envelope. On pointerdown we stamp
// `data-aftersign-packet-press="pressing"` on `#packetButton` and schedule
// a restore via `setTimeout(hold-ms)` so the CSS rule for the pressing
// marker (see `#packetButton[data-aftersign-packet-press="pressing"]` in
// `index.html`) paints `transform: scale(--aftersign-packet-press-scale-from)`
// for the full hold window — the 64ms sample in the spec lands INSIDE the
// compressed envelope regardless of finger contact duration.
//
// Prior-value restore: unlike the job-take offers, `#packetButton` does
// not use `data-aftersign-packet-press` for any state other than the
// press marker itself, so the "prior" is always the absence of the
// attribute. We remove it on restore rather than restoring a stale value.
//
// Same-id replacement: `#packetButton` is a fixed element in the DOM
// (unlike job offers, which are re-rendered under `#offeredJobs`), so
// there is no `inFlight` inherit map here. If a future refactor
// re-renders the packet button, mirror `jobOfferPressing.js`'s inFlight
// map (see comments there).

const FALLBACK_HOLD_MS = 96;
const attachedButtons = new WeakSet();

function resolveHoldMs(button) {
  // Read from the computed CSS (--aftersign-packet-press-hold-ms is
  // authored on :root in index.html). getPropertyValue on inline style
  // returns "" for :root vars; use getComputedStyle so the cascade
  // resolves it.
  const raw = getComputedStyle(button)
    .getPropertyValue("--aftersign-packet-press-hold-ms")
    .trim();
  const holdMs = Number.parseFloat(raw);
  return Number.isFinite(holdMs) && holdMs > 0 ? holdMs : FALLBACK_HOLD_MS;
}

function armPressing(button) {
  // Guard: don't re-arm inside an existing hold — the outstanding
  // setTimeout will still restore the attribute at its original
  // deadline, so a second pointerdown mid-hold would either double-
  // stack the marker or race the restore. A single press-per-hold is
  // the intended shape.
  if (button.getAttribute("data-aftersign-packet-press") === "pressing") return;

  const holdMs = resolveHoldMs(button);
  button.setAttribute("data-aftersign-packet-press", "pressing");

  window.setTimeout(() => {
    // Only clear if we're still the ones holding the marker. A future
    // handler that stamps a different value inside the hold window
    // (e.g. an "armed" state) should not be clobbered on restore.
    if (button.getAttribute("data-aftersign-packet-press") === "pressing") {
      button.removeAttribute("data-aftersign-packet-press");
    }
  }, holdMs);
}

/** Attach the canonical packet-press marker to `#packetButton`. */
export function attachPacketOfferPressing(button) {
  if (!(button instanceof HTMLButtonElement) || attachedButtons.has(button)) return;
  attachedButtons.add(button);
  button.addEventListener("pointerdown", () => armPressing(button), { passive: true });
}

function attachMounted() {
  const button = document.getElementById("packetButton");
  if (button instanceof HTMLButtonElement) attachPacketOfferPressing(button);
}

// The packet button ships in the initial HTML, so it's typically already
// mounted by the time this module executes. Attach immediately, and also
// re-attempt after DOMContentLoaded in case module ordering ever changes.
attachMounted();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", attachMounted, { once: true });
}
