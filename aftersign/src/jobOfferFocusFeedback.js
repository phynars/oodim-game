/**
 * Keeps the selected delivery offer visibly latched after touch release.
 *
 * The route starts only after the offer callback runs, so this class is
 * intentionally presentation-only: it must never delay or suppress the
 * player's committed choice.
 *
 * Two rendered channels — both testable, no dead surface (Soren's PR
 * #1914 REQUEST_CHANGES, AI006):
 *
 *   1. WAAPI `boxShadow` keyframe on the button — a warm glow that
 *      peaks mid-envelope and decays to a soft residue by
 *      `JOB_OFFER_FOCUS_FEEDBACK_MS`.
 *
 *   2. A one-time `<style>` block (installed idempotently on first
 *      call per document) that renders an outline while the dataset
 *      marker `data-aftersign-job-offer-committed="true"` is present,
 *      transitioning off the `--aftersign-job-offer-commit-duration`
 *      custom property. This makes BOTH the marker and the duration
 *      variable load-bearing — remove either and the outline breaks.
 *
 * The consumer test at
 * `apps/web/src/aftersign/jobOfferFocusFeedback.consumer.test.ts`
 * drives this module through jsdom + fake timers and pins:
 *   • dataset marker stamped immediately, cleared at 180ms,
 *   • `--aftersign-job-offer-commit-duration` stamped as `180ms`,
 *   • the installed `<style>` block references both tokens,
 *   • `button.animate` called with the boxShadow keyframe, 180ms
 *     duration, and the cubic-bezier easing.
 */
export const JOB_OFFER_FOCUS_FEEDBACK_MS = 180;

const STYLE_MARKER = "aftersign-job-offer-focus-feedback";

/**
 * Install the outline consumer rule once per document. Idempotent —
 * multiple calls on the same document are a no-op after the first.
 *
 * The rule reads BOTH tokens the module stamps:
 *   • `data-aftersign-job-offer-committed="true"` — the selector.
 *   • `--aftersign-job-offer-commit-duration` — the transition timing.
 * If either drifts (attribute renamed, custom-property renamed), the
 * outline stops rendering and the consumer test reds.
 */
function installJobOfferFocusFeedbackStyles(ownerDocument) {
  if (!ownerDocument || typeof ownerDocument.createElement !== "function") return;
  const head = ownerDocument.head || ownerDocument.documentElement;
  if (!head) return;
  const existing = ownerDocument.querySelector(
    `style[data-${STYLE_MARKER}="true"]`,
  );
  if (existing) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(`data-${STYLE_MARKER}`, "true");
  style.textContent = `
    button[data-aftersign-job-offer-committed="true"] {
      outline: 2px solid rgba(255, 193, 105, 0.72);
      outline-offset: 2px;
      transition: outline-color var(--aftersign-job-offer-commit-duration, 180ms)
        cubic-bezier(0.16, 1, 0.3, 1);
    }
  `;
  head.appendChild(style);
}

export function playJobOfferFocusFeedback(button, now = globalThis.performance?.now?.bind(globalThis.performance)) {
  if (!button || typeof button.setAttribute !== "function") return () => {};

  const ownerDocument =
    button.ownerDocument ||
    (typeof document !== "undefined" ? document : null);
  if (ownerDocument) {
    installJobOfferFocusFeedbackStyles(ownerDocument);
  }

  const startedAt = now?.() ?? Date.now();
  button.dataset.aftersignJobOfferCommitted = "true";
  button.style.setProperty("--aftersign-job-offer-commit-duration", `${JOB_OFFER_FOCUS_FEEDBACK_MS}ms`);
  // Shadow-only: press feedback remains the transform authority.
  const animation = typeof button.animate === "function"
    ? button.animate(
        [
          { boxShadow: "0 0 0 rgba(255, 193, 105, 0)" },
          { boxShadow: "0 0 18px rgba(255, 193, 105, 0.72)" },
          { boxShadow: "0 0 6px rgba(255, 193, 105, 0.22)" },
        ],
        { duration: JOB_OFFER_FOCUS_FEEDBACK_MS, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      )
    : null;

  const clear = () => {
    button.removeAttribute("data-aftersign-job-offer-committed");
    button.style.removeProperty("--aftersign-job-offer-commit-duration");
  };

  const remaining = Math.max(0, JOB_OFFER_FOCUS_FEEDBACK_MS - ((now?.() ?? Date.now()) - startedAt));
  const timeout = globalThis.setTimeout(clear, remaining);
  return () => {
    globalThis.clearTimeout(timeout);
    animation?.cancel();
    clear();
  };
}
