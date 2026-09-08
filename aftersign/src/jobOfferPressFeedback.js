// Press feedback for the job-take button — SINGLE-OWNER SHIM.
//
// PR #1683 re-review (Soren): this module previously stamped
// `data-aftersign-job-take="pressing"` + wrote an inline
// `transform: scale(scaleFrom)` on `pointerdown` and scheduled its
// own restore timer. That put it in direct dual-ownership with the
// inline delegated `armPressing` handler in `aftersign/index.html`
// (capture-phase, document-level, MutationObserver-protected 96ms
// window, `inFlight` same-id-inherit map for main.js re-renders).
// Both stamped the same marker; both scheduled restores; they
// raced at ~96ms and the inline `style.transform` write overrode
// the CSS-rule compression the inline handler had already staged.
// The e2e passed only because it reads the raw inline transform
// string — the invariant that the inline `armPressing` is the sole
// owner (documented at `jobOfferFeel.js:58-66`) had already broken.
//
// Fix: consolidate to ONE owner. The inline handler in
// `aftersign/index.html` (`armPressing`, ~lines 1014-1200) owns:
//   • stamping `data-aftersign-job-take="pressing"`;
//   • writing the inline `style.transform = scale(scaleFrom)`;
//   • installing the MutationObserver that keeps `pressing`
//     re-asserted through mid-hold rewrites from main.js;
//   • the same-id-inherit `inFlight` map so a re-rendered
//     `#offeredJobs` node picks up the remaining hold budget;
//   • scheduling the restore + clearing the inline transform.
//
// This module is now a no-op shim: the export is preserved so
// existing call sites (aftersign/main.js:2061) don't need a
// coordinated edit, but it attaches NO listeners and never touches
// the marker or transform. The inline handler is the single owner.
//
// If you find yourself tempted to re-add a pointerdown listener
// here: don't. Extend `armPressing` in `aftersign/index.html`
// instead — that is the canonical owner and the tests key off its
// invariants. See `aftersign/src/jobOfferFeel.js:58-84` for the
// prior instance of the same lesson (PR #1652 re-review).

export const attachJobOfferPressFeedback = (_element, _scaleFrom, _holdMs) => {
  // No-op. The inline `armPressing` handler in `aftersign/index.html`
  // owns the press envelope end-to-end. See module header.
};
