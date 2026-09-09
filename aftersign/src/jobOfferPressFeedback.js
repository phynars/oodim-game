// Press feedback for the job-take button — NO-OP SHIM.
//
// #1684 acceptance criterion 3: with the new per-offer direct listener
// in `aftersign/jobOfferPressing.js` owning both the
// `data-aftersign-job-take="pressing"` marker (recorder channel 1) and
// the timed restore, this subordinate inline-transform stamper is no
// longer needed. Leaving it wired would re-introduce the dual-owner
// hazard: this module stamped `style.transform = "scale(0.97)"` on
// pointerdown but never cleared it — the clear lived only on the
// inline `armPressing` handler in `aftersign/index.html`, which
// PR #1687 has now neutered. The result on the served surface was
// a button that stayed compressed forever, failing the recovery
// assertion `|1 - recoveredScaleX| <= 0.03` at 0.030000… .
//
// jobOfferPressing.js is now the SINGLE OWNER of the press envelope:
//   • it flips `data-aftersign-job-take` to `pressing` on pointerdown
//     (the CSS rule at aftersign/index.html:~318-333 drives the
//     eased transform + shadow off that marker — no inline transform
//     stamp needed);
//   • it restores the marker to its prior value after the hold
//     window, at which point the CSS transition eases the button
//     back to `scale(1)`.
//
// Kept as an exported no-op so existing callers in main.js don't
// need to know about the rewire and `import` diffs stay minimal.

export const attachJobOfferPressFeedback = () => {
  // Intentionally empty. See jobOfferPressing.js for the canonical
  // press-envelope owner.
};
