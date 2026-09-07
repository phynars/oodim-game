export const JOB_OFFER_FEEL = Object.freeze({
  armDelayMs: 0,
  durationMs: 180,
  liftPx: 3,
  scalePeak: 1.025,
  glowPx: 18,
  glowAlpha: 0.32,
  easing: "cubic-bezier(0.2, 0.9, 0.2, 1)",
});

const setFeelVars = (node, feel = JOB_OFFER_FEEL) => {
  node.style.setProperty("--job-offer-feel-duration-ms", `${feel.durationMs}ms`);
  node.style.setProperty("--job-offer-feel-lift-px", `${feel.liftPx}px`);
  node.style.setProperty("--job-offer-feel-scale-peak", `${feel.scalePeak}`);
  node.style.setProperty("--job-offer-feel-glow-px", `${feel.glowPx}px`);
  node.style.setProperty("--job-offer-feel-glow-alpha", `${feel.glowAlpha}`);
  node.style.setProperty("--job-offer-feel-easing", feel.easing);
};

export const applyJobOfferFeel = (node, feel = JOB_OFFER_FEEL) => {
  if (!node) return null;
  setFeelVars(node, feel);
  node.dataset.aftersignJobOfferFeel = "armed";
  node.animate(
    [
      {
        transform: "translateY(0) scale(1)",
        filter: "drop-shadow(0 0 0 rgba(143, 233, 255, 0))",
      },
      {
        transform: `translateY(-${feel.liftPx}px) scale(${feel.scalePeak})`,
        filter: `drop-shadow(0 0 ${feel.glowPx}px rgba(143, 233, 255, ${feel.glowAlpha}))`,
        offset: 0.42,
      },
      {
        transform: "translateY(0) scale(1)",
        filter: "drop-shadow(0 0 0 rgba(143, 233, 255, 0))",
      },
    ],
    {
      duration: feel.durationMs,
      easing: feel.easing,
      fill: "none",
    },
  );
  return { ...feel };
};

// When the `aftersign-job-take` press-juice layer claims the same
// button (by stamping `[data-aftersign-job-take]` at render), its CSS
// `transform: scale(var(--aftersign-job-take-scale-from))` owns the
// transform channel for the 96ms compression window. A Web Animation
// from `applyJobOfferFeel` sits in the Animation origin and beats
// author-origin CSS on `transform`, so we DEFER the visual layer
// entirely to the press-juice CSS when that data attribute is
// present, and only forward `onChoose` on click.
//
// PR #1652 re-review (Soren): the inline capture-phase pointerdown
// listener in `aftersign/index.html` (`armPressing`) is the SINGLE
// owner of the `pressing` marker + MutationObserver-protected 96ms
// compression window (see #1649). This module used to also stamp
// `pressing` on its own `touchstart`/`pointerdown` listeners; for a
// Playwright `touchscreen.tap()` the JS-fired `touchstart` runs
// BEFORE the inline `pointerdown`, so when the inline listener then
// fired it saw `prior === "pressing"` and hit its early-return —
// meaning the MutationObserver that protects the compression window
// was NEVER installed, and the `scaleDrop >= 0.015` trip-wire
// measured 0. Fix: this module no longer touches the
// `data-aftersign-job-take` attribute. The inline listener owns it
// end-to-end; the CSS `transition: transform 96ms` runs to
// completion; `onChoose` fires synchronously on click, matching the
// tuned 96ms hold + release envelope the CSS + `resolveHoldMs` both
// agree on.
const hasJobTakePressLayer = (button) =>
  Boolean(
    button &&
      button.hasAttribute &&
      button.hasAttribute("data-aftersign-job-take"),
  );

// PR #1662 — resolve the tuned press-hold in ms for the deferred
// `onChoose` scheduler below. Mirrors the shape of `resolveHoldMs`
// in `aftersign/index.html`'s inline armPressing block: read the
// `--aftersign-job-take-hold-ms` CSS variable that
// `applyAftersignJobTakeFeelToButton` stamps on the button at
// render time; parse the `<number>ms` suffix; fall back to 96
// (the frozen `holdMs` in `apps/web/src/aftersign/aftersignJobTakeFeel.js`)
// when the stamp is missing or unparseable. Returns 0 only when
// there is no button/style to read at all, which keeps the caller's
// setTimeout guard on `holdMs > 0` safe.
const FALLBACK_JOB_TAKE_HOLD_MS = 96;
const readJobTakeHoldMs = (button) => {
  if (
    !button ||
    typeof button.ownerDocument === "undefined" ||
    typeof getComputedStyle !== "function"
  ) {
    return FALLBACK_JOB_TAKE_HOLD_MS;
  }
  try {
    const raw = getComputedStyle(button)
      .getPropertyValue("--aftersign-job-take-hold-ms")
      .trim();
    if (raw) {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch (_err) {
    /* fall through */
  }
  return FALLBACK_JOB_TAKE_HOLD_MS;
};

export const armJobOfferFeel = (button, onChoose, feel = JOB_OFFER_FEEL) => {
  if (!button) return null;
  setFeelVars(button, feel);
  button.dataset.aftersignJobOfferFeel = "ready";
  // Visual layer: only for the legacy path (no press-juice marker).
  // When `[data-aftersign-job-take]` is present, the inline capture-
  // phase pointerdown listener owns the transform channel; adding a
  // Web Animation here would clobber it (Animation-origin > author-
  // origin on `transform`).
  button.addEventListener("pointerdown", () => {
    if (hasJobTakePressLayer(button)) return;
    applyJobOfferFeel(button, feel);
  });
  button.addEventListener("click", () => {
    if (hasJobTakePressLayer(button)) {
      // PR #1662 (fix for #1661 press-juice RED).
      //
      // The inline capture-phase pointerdown listener in
      // `aftersign/index.html` (`armPressing`) already flipped the
      // marker to "pressing" and installed the MutationObserver
      // that protects the marker for the 96ms hold. The CSS press
      // rule (now specificity 0,2,1 after this same PR) is painting
      // `transform: scale(var(--aftersign-job-take-scale-from))`
      // — the compressed 0.97 bounding box the e2e samples at 64ms.
      //
      // The bug the specificity fix alone did NOT close: firing
      // `onChoose(...)` synchronously here advances state (main.js
      // calls `choose(action)`), which triggers `renderText()` and
      // rewrites `#offeredJobs.innerHTML`. The pressing button node
      // can be DETACHED from the DOM in the same task, and the
      // replacement node (if any) is a fresh "ready" button at
      // scale 1. The `#1658` inFlight same-id inherit map in
      // index.html *does* re-stamp the replacement to "pressing" for
      // the remaining hold budget — but the compressed transform is
      // painted via the CSS transition, which restarts on the newly
      // attached node from the base rule's identity scale. During
      // the same task that swaps the DOM, the inline capture-phase
      // stamp on the OLD node has already been discarded. Deferring
      // `onChoose` by `hold-ms` sidesteps all of that: the original
      // pressing node stays attached through the full 96ms
      // compression window; only after paint has resolved on the
      // original node do we advance state and let the re-render
      // happen. The 64ms sample lands cleanly; the 480ms recovery
      // sample lands on whichever node the writer produced next.
      //
      // The setTimeout reads the resolved hold from the SAME CSS var
      // the press rule + the inline `resolveHoldMs` consume, with a
      // `getComputedStyle` fallback so a caller that stamped only
      // the feel row (not the JS-side row) still gets the tuned
      // hold. Read once at click time; the tap has already committed
      // intent, we're just letting the paint finish.
      const holdMs = readJobTakeHoldMs(button);
      const invoke = () => {
        if (typeof onChoose === "function") onChoose({ ...feel });
      };
      if (holdMs > 0 && typeof setTimeout === "function") {
        setTimeout(invoke, holdMs);
      } else {
        invoke();
      }
      return;
    }
    const applied = applyJobOfferFeel(button, feel);
    if (typeof onChoose === "function") onChoose(applied);
  });
  return { ...feel };
};
