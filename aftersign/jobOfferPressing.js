// Canonical job-offer press owner for the served AFTERSIGN surface.
//
// Each rendered offer owns its pointerdown listener. This avoids the
// document-capture delegation path whose target resolution did not reach the
// served Playwright touch surface, while preserving the CSS-owned press marker.

const FALLBACK_HOLD_MS = 96;
const attachedButtons = new WeakSet();

function resolveHoldMs(button) {
  const raw = button.style.getPropertyValue("--aftersign-job-take-hold-ms");
  const holdMs = Number.parseFloat(raw);
  return Number.isFinite(holdMs) && holdMs > 0 ? holdMs : FALLBACK_HOLD_MS;
}

function armPressing(button) {
  const prior = button.getAttribute("data-aftersign-job-take");
  if (prior !== "ready" && prior !== "armed") return;

  const holdMs = resolveHoldMs(button);
  let pendingIntent = null;
  const observer = new MutationObserver(() => {
    const value = button.getAttribute("data-aftersign-job-take");
    if (value && value !== "pressing") {
      pendingIntent = value;
      button.setAttribute("data-aftersign-job-take", "pressing");
    }
  });

  button.setAttribute("data-aftersign-job-take", "pressing");
  observer.observe(button, {
    attributes: true,
    attributeFilter: ["data-aftersign-job-take"],
  });

  window.setTimeout(() => {
    observer.disconnect();
    if (pendingIntent !== null) {
      button.setAttribute("data-aftersign-job-take", pendingIntent);
    } else if (button.getAttribute("data-aftersign-job-take") === "pressing") {
      button.setAttribute("data-aftersign-job-take", prior);
    }
  }, holdMs);
}

/** Attach the canonical press marker to one rendered job-offer button. */
export function attachJobOfferPressing(button) {
  if (!(button instanceof HTMLButtonElement) || attachedButtons.has(button)) return;
  attachedButtons.add(button);
  button.addEventListener("pointerdown", () => armPressing(button), { passive: true });
}

function attachMountedJobOffers(root = document) {
  root.querySelectorAll("button[data-aftersign-job-take]").forEach(attachJobOfferPressing);
}

attachMountedJobOffers();
new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches("button[data-aftersign-job-take]")) attachJobOfferPressing(node);
      attachMountedJobOffers(node);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
