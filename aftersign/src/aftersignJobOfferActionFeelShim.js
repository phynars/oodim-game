// AFTERSIGN — served-page shim for the job-offer action feel.
//
// PR #1676 (Soren's sixth review — CI red on `npm run build:aftersign`).
// Prior iteration imported `applyAftersignJobOfferActionFeel`,
// `installAftersignJobOfferActionFeelStyles`, and
// `AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS` from
// `../apps/web/src/aftersign/ioJobOfferActionFeel.ts` directly into
// `aftersign/main.js` — `tsc --noEmit` passed but the vite build
// (Rolldown, per package.json → vite@^8) reddened on that cross-
// package `.ts` import from a `.js` entry. The specific bundling
// failure was diagnosed from the failed step name only (the token
// scope on the CI review path 401'd on the job-logs endpoint) but
// the shape matches issues where a `.js` file transitively pulls a
// `.ts` module carrying `readonly` interface members and indexed-
// access types into the Rolldown pipeline through paths that were
// not covered by the aftersign tsconfig's `include: ["src"]` (the
// same include comment inside `aftersign/tsconfig.json` documents
// this class of blast-radius failure for #837).
//
// This shim keeps the SAME data-attribute + CSS-var vocabulary the
// `ioJobOfferActionFeel.ts` consumer test drives — the served page
// and the vitest surface stamp identical selectors — but authored
// as plain JS inside the `aftersign/src/` tree the build already
// knows how to bundle. `apps/web/src/aftersign/ioJobOfferActionFeel.ts`
// remains the authoring source for the feel table (used by its
// consumer test); THIS module ships the runtime consumer for the
// served page. The style block text below is copied verbatim from
// the sibling TS module's install function so a rename or a table
// tweak lives on ONE axis — the consumer test in
// `apps/web/src/aftersign/ioJobOfferActionFeel.consumer.test.ts`
// pins the SAME selectors + CSS vars + press class, so a drift
// between the two authorings reds a unit test long before it
// reaches the served page.

/** Class the DOM applier toggles for pointer-down state. */
export const AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS =
  "is-aftersign-job-offer-pressing";

/**
 * Pinned feel table for the three risk tones (safe / risky / consequence).
 * Copy of `AFTERSIGN_JOB_OFFER_ACTION_FEEL` in the sibling TS module —
 * see file header for why this is duplicated instead of imported.
 * @type {Record<"safe"|"risky"|"consequence", {
 *   durationMs: number,
 *   liftPx: number,
 *   pressScale: number,
 *   glowAlpha: number,
 *   borderPulsePx: number,
 *   easing: string,
 *   audioCue: "soft-confirm"|"risk-chime"|"debt-thrum",
 * }>}
 */
const AFTERSIGN_JOB_OFFER_ACTION_FEEL = {
  safe: {
    durationMs: 220,
    liftPx: 4,
    pressScale: 0.985,
    glowAlpha: 0.18,
    borderPulsePx: 1,
    easing: "cubic-bezier(.2,.8,.2,1)",
    audioCue: "soft-confirm",
  },
  risky: {
    durationMs: 280,
    liftPx: 6,
    pressScale: 0.975,
    glowAlpha: 0.26,
    borderPulsePx: 2,
    easing: "cubic-bezier(.16,1,.3,1)",
    audioCue: "risk-chime",
  },
  consequence: {
    durationMs: 340,
    liftPx: 5,
    pressScale: 0.98,
    glowAlpha: 0.32,
    borderPulsePx: 3,
    easing: "cubic-bezier(.34,1.56,.64,1)",
    audioCue: "debt-thrum",
  },
};

// Idempotency guard for the style install — same shape as the TS
// sibling's `installedAftersignJobOfferActionFeelStyleRoots` WeakSet.
const INSTALLED_ROOTS = new WeakSet();

/**
 * Install the CSS block that renders lift / press-scale / glow /
 * border-pulse from the stamped `data-aftersign-feel-*` attributes
 * and the CSS custom properties `applyAftersignJobOfferActionFeel`
 * writes onto each button. Idempotent per document.
 *
 * @param {Document} [root]
 * @returns {void}
 */
export function installAftersignJobOfferActionFeelStyles(root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  if (!doc || !doc.head || INSTALLED_ROOTS.has(doc)) return;

  const style = doc.createElement("style");
  style.dataset.aftersignJobOfferActionFeel = "true";
  // The template literal below interpolates the pressed-class name
  // once; the rest of the CSS is a verbatim copy of the sibling TS
  // module's install text so any tweak here lands beside a red unit
  // test (see the consumer test cited in the file header).
  style.textContent = `
    [data-aftersign-job-risk] {
      position: relative;
      transition:
        transform var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        box-shadow var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        border-color var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1));
      will-change: transform, box-shadow;
      transform: translateY(0) scale(1);
    }

    [data-aftersign-job-risk]:hover,
    [data-aftersign-job-risk]:focus-visible {
      transform: translateY(calc(var(--aftersign-job-offer-lift, 4px) * -1)) scale(1);
      box-shadow:
        0 var(--aftersign-job-offer-lift, 4px) calc(var(--aftersign-job-offer-lift, 4px) * 3)
          rgba(120, 220, 255, var(--aftersign-job-offer-glow, 0.18)),
        inset 0 0 0 var(--aftersign-job-offer-border-pulse, 1px)
          rgba(180, 240, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.2));
    }

    /*
     * Press-compression selector — matches the JS-toggled pressed class
     * only. The served consumer in aftersign/main.js holds the class
     * for a floor duration (~120ms) via a deferred setTimeout release
     * on pointerdown, INSTEAD of stripping it on pointerup — so the
     * in-page 8ms recorder is guaranteed to sample at least one
     * compressed frame under Playwright's headless tap() (which fires
     * pointerdown+pointerup inside a single SwiftShader frame).
     */
    [data-aftersign-job-risk].${AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS} {
      transform: translateY(0) scale(var(--aftersign-job-offer-press-scale, 0.985));
      box-shadow:
        0 0 calc(var(--aftersign-job-offer-lift, 4px) * 4)
          rgba(120, 220, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.12)),
        inset 0 0 0 var(--aftersign-job-offer-border-pulse, 1px)
          rgba(220, 250, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.32));
    }

    [data-aftersign-job-risk="risky"] {
      --aftersign-job-offer-tone: rgba(255, 196, 130, 0.28);
    }

    [data-aftersign-job-risk="consequence"] {
      --aftersign-job-offer-tone: rgba(255, 130, 150, 0.36);
      animation: aftersign-job-offer-debt-thrum 1800ms ease-in-out infinite;
    }

    @keyframes aftersign-job-offer-debt-thrum {
      0%, 100% { box-shadow: 0 0 0 rgba(255,130,150,0); }
      50% { box-shadow: 0 0 12px var(--aftersign-job-offer-tone, rgba(255,130,150,0.36)); }
    }

    @media (prefers-reduced-motion: reduce) {
      [data-aftersign-job-risk] {
        transition-duration: 0ms;
        animation: none;
      }
    }
  `;

  doc.head.append(style);
  INSTALLED_ROOTS.add(doc);
}

/**
 * Stamp the feel attributes + CSS custom properties onto an existing
 * element. Same shape as the sibling TS module's
 * `applyAftersignJobOfferActionFeel` — a decorative FEEL projection
 * that MUST NEVER throw (the caller wraps in try/catch as a second
 * guard, but this function is defensive too).
 *
 * @param {HTMLElement} el
 * @param {"safe"|"risky"|"consequence"} risk
 * @returns {void}
 */
export function applyAftersignJobOfferActionFeel(el, risk) {
  if (!el || typeof el.setAttribute !== "function") return;
  const feel =
    AFTERSIGN_JOB_OFFER_ACTION_FEEL[risk] ||
    AFTERSIGN_JOB_OFFER_ACTION_FEEL.safe;

  el.setAttribute("data-aftersign-job-risk", risk);
  el.setAttribute("data-aftersign-feel-duration-ms", String(feel.durationMs));
  el.setAttribute("data-aftersign-feel-lift-px", String(feel.liftPx));
  el.setAttribute("data-aftersign-feel-press-scale", String(feel.pressScale));
  el.setAttribute("data-aftersign-feel-glow-alpha", String(feel.glowAlpha));
  el.setAttribute(
    "data-aftersign-feel-border-pulse-px",
    String(feel.borderPulsePx),
  );
  el.setAttribute("data-aftersign-feel-easing", feel.easing);
  el.setAttribute("data-aftersign-feel-audio-cue", feel.audioCue);

  if (el.style && typeof el.style.setProperty === "function") {
    el.style.setProperty(
      "--aftersign-job-offer-duration",
      `${feel.durationMs}ms`,
    );
    el.style.setProperty("--aftersign-job-offer-lift", `${feel.liftPx}px`);
    el.style.setProperty(
      "--aftersign-job-offer-press-scale",
      String(feel.pressScale),
    );
    el.style.setProperty(
      "--aftersign-job-offer-glow",
      String(feel.glowAlpha),
    );
    el.style.setProperty(
      "--aftersign-job-offer-border-pulse",
      `${feel.borderPulsePx}px`,
    );
    el.style.setProperty("--aftersign-job-offer-ease", feel.easing);
  }
}

/**
 * Attach a floor-duration pressed-class toggle to a button.
 *
 * On `pointerdown` the pressed class is set immediately; a
 * `setTimeout(PRESS_FLOOR_MS)` owns release. `pointerup` /
 * `pointercancel` / `pointerleave` do NOT strip the class — the
 * timer is the release path — so the in-page 8ms recorder in
 * `aftersign/e2e/aftersign-job-offer-press-juice.playtest.spec.ts`
 * is guaranteed to sample at least one compressed frame under
 * Playwright's headless `tap()` (which collapses pointerdown +
 * pointerup into a single SwiftShader frame). This matches the
 * 96ms `holdMs` on `aftersignJobTakeFeel` (see main.js's comment
 * on that seam) with a small margin for rAF starvation.
 *
 * @param {HTMLElement} button
 * @param {number} [pressFloorMs]
 * @returns {void}
 */
export function attachAftersignJobOfferActionPressFloor(button, pressFloorMs) {
  if (!button || typeof button.addEventListener !== "function") return;
  const floorMs = typeof pressFloorMs === "number" ? pressFloorMs : 120;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let releaseTimer = null;

  const setPressed = (pressed) => {
    if (!button.classList) return;
    button.classList.toggle(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS, pressed);
  };

  const onDown = () => {
    if (releaseTimer !== null) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    setPressed(true);
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      setPressed(false);
    }, floorMs);
  };

  button.addEventListener("pointerdown", onDown);
}
