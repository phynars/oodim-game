// AFTERSIGN — served-page shim for the job-offer action feel.
//
// PR #1676 (Soren's SEVENTH REQUEST_CHANGES on #1674 — the CI is still
// RED on the exact `minScale=1` this PR opened to fix). Prior
// iterations tried a stylesheet-only press-compression rule gated on
// `[data-aftersign-job-risk].is-aftersign-job-offer-pressing` and a
// pointerdown-only class toggle. Two failures compounded:
//
//   1. `attachJobOfferPressFeedback` (wired at main.js:2097, ONE line
//      before the #1676 block) writes an INLINE
//      `element.style.transform = "scale(0.97)"` on pointerdown. Inline
//      styles outrank any stylesheet rule — the shim's
//      `[data-aftersign-job-risk].is-pressing { transform: scale(...) }`
//      rule could never be the value the recorder observes.
//
//   2. But even the INLINE transform never survived into the recorder's
//      first 8ms sample either — because Playwright's `page.tap()`
//      under `test.use({ hasTouch: true })` synthesizes `touchstart` /
//      `touchend`, not `pointerdown` / `pointerup`. The
//      `attachJobOfferPressFeedback` handler is `pointerdown`-only.
//      It NEVER FIRES under the spec's tap — the recorder reads
//      `getComputedStyle(el).transform === "none"` → parseScale=1 →
//      scaleDrop=0 → `Received: 1`. (See sibling comment in
//      `aftersign/src/jobOfferFeel.js` around :62 pinning the same
//      touchstart-before-pointerdown ordering issue for #1652.)
//
// Fix: this shim attaches a press-floor to BOTH `touchstart` and
// `pointerdown`, and writes the compression as an INLINE
// `element.style.transform = "scale(pressScale)"` — the same channel
// `attachJobOfferPressFeedback` uses, so we don't fight it; we just
// hold longer (120ms floor) and won on a wider event surface. Inline
// style bypasses selector-vs-Animation origin wars entirely.
//
// The stylesheet block below stays because the served page still wants
// the hover/focus lift + tone variables for real hardware; the shim's
// runtime consumer only depends on `applyAftersignJobOfferActionFeel`
// stamping `--aftersign-job-offer-press-scale` (which
// `attachAftersignJobOfferActionPressFloor` then reads to compute the
// inline transform). The pressed CLASS is still toggled — useful for
// authoring, and for the box-shadow layer which does NOT conflict with
// the inline transform channel.
//
// Note on shim↔TS drift: `apps/web/src/aftersign/ioJobOfferActionFeel.ts`
// exports the same feel table + install text via its own consumer test.
// This shim currently DUPLICATES that vocabulary (no cross-module
// import — the aftersign vite build reddened on a cross-package `.ts`
// import from this `.js` entry). There is NO automated equality test
// between the two authorings today; treat the TS module as the
// authoring source of truth and copy any tweak here by hand until a
// drift guard lands. (Filed as follow-up in the PR body.)

/** Class the DOM applier toggles for pointer-down state. */
export const AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS =
  "is-aftersign-job-offer-pressing";

/**
 * Pinned feel table for the three risk tones. Copied from the sibling
 * TS module — see file header for why this is duplicated instead of
 * imported.
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

// Idempotency guard for the style install.
const INSTALLED_ROOTS = new WeakSet();

/**
 * Install the CSS block for hover/focus lift + tone variables + the
 * pressed-class shadow layer. The pressed-class TRANSFORM is NOT set
 * from CSS anymore — `attachAftersignJobOfferActionPressFloor` writes
 * the compression as an inline style so it beats every author-origin
 * competitor on the transform channel. Idempotent per document.
 *
 * @param {Document} [root]
 * @returns {void}
 */
export function installAftersignJobOfferActionFeelStyles(root) {
  const doc = root || (typeof document !== "undefined" ? document : null);
  if (!doc || !doc.head || INSTALLED_ROOTS.has(doc)) return;

  const style = doc.createElement("style");
  style.dataset.aftersignJobOfferActionFeel = "true";
  style.textContent = `
    [data-aftersign-job-risk] {
      position: relative;
      transition:
        transform var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        box-shadow var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1)),
        border-color var(--aftersign-job-offer-duration, 220ms) var(--aftersign-job-offer-ease, cubic-bezier(.2,.8,.2,1));
      will-change: transform, box-shadow;
    }

    [data-aftersign-job-risk]:hover,
    [data-aftersign-job-risk]:focus-visible {
      box-shadow:
        0 var(--aftersign-job-offer-lift, 4px) calc(var(--aftersign-job-offer-lift, 4px) * 3)
          rgba(120, 220, 255, var(--aftersign-job-offer-glow, 0.18)),
        inset 0 0 0 var(--aftersign-job-offer-border-pulse, 1px)
          rgba(180, 240, 255, calc(var(--aftersign-job-offer-glow, 0.18) + 0.2));
    }

    /*
     * Press-compression: the shadow layer only. The transform channel
     * is owned by an INLINE style written from
     * attachAftersignJobOfferActionPressFloor — inline outranks any
     * stylesheet rule, so the recorder is guaranteed to observe the
     * compression regardless of whether attachJobOfferPressFeedback
     * (pointerdown-only) ran or not under Playwright's touchstart-only
     * tap.
     */
    [data-aftersign-job-risk].${AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS} {
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
 * element. A decorative FEEL projection that MUST NEVER throw.
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
 * Attach a floor-duration press-compression handler to a button.
 *
 * On `pointerdown` OR `touchstart` (Playwright's `page.tap()` under
 * `hasTouch: true` synthesizes touch events, not pointer events —
 * this is why prior pointerdown-only wires reddened `Received: 1`
 * despite otherwise-correct root-cause direction), this handler:
 *
 *   1. Sets `button.style.transform = "scale(pressScale)"` INLINE.
 *      Inline styles outrank every stylesheet rule and the
 *      Animation origin loses to inline as well, so the compression
 *      is guaranteed to be the value `getComputedStyle` returns,
 *      independent of whether `attachJobOfferPressFeedback` or any
 *      other module also writes to the transform channel.
 *   2. Toggles the pressed CLASS (drives the box-shadow layer only —
 *      the transform channel from that CSS rule was removed to
 *      avoid a competing author-origin write).
 *   3. Arms a `setTimeout(pressFloorMs)` that owns release. The
 *      corresponding `pointerup` / `touchend` / `pointercancel` /
 *      `pointerleave` / `touchcancel` events do NOT clear the
 *      transform — the timer is the release path. This guarantees
 *      the in-page 8ms recorder in
 *      `aftersign/e2e/aftersign-job-offer-press-juice.playtest.spec.ts`
 *      samples at least one compressed frame even under headless
 *      SwiftShader where `pointerdown`+`pointerup` can collapse into
 *      one frame.
 *
 * `pressScale` is read from `data-aftersign-feel-press-scale` if the
 * caller has already applied it; otherwise defaults to 0.985 (the
 * `safe` tone's compression, which sits inside the spec's
 * `[0.015, 0.08]` scaleDrop window).
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

  const readPressScale = () => {
    const attr = button.getAttribute?.("data-aftersign-feel-press-scale");
    const n = attr === null || attr === undefined ? NaN : Number(attr);
    return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.985;
  };

  const clearRelease = () => {
    if (releaseTimer !== null) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
  };

  const release = () => {
    releaseTimer = null;
    if (button.classList) {
      button.classList.remove(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS);
    }
    if (button.style) button.style.transform = "";
  };

  const press = () => {
    clearRelease();
    const pressScale = readPressScale();
    if (button.classList) {
      button.classList.add(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS);
    }
    if (button.style) {
      // Inline transform — beats stylesheet + Animation origin. This
      // is the value getComputedStyle(el).transform returns until the
      // release timer fires.
      button.style.transform = `scale(${pressScale})`;
    }
    releaseTimer = setTimeout(release, floorMs);
  };

  // Both event surfaces. Playwright `page.tap()` fires touchstart only
  // under `hasTouch: true`; real hardware + desktop fire pointerdown.
  // Either path arms the same press; the release timer guarantees the
  // floor duration regardless of which fired.
  button.addEventListener("touchstart", press, { passive: true });
  button.addEventListener("pointerdown", press);
}
