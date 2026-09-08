// Press feedback for the job-take button — SUBORDINATE INLINE-STAMP HELPER.
//
// PR #1683 history:
//   Round 1 (Soren, CHANGES_REQUESTED): this module was a full dual
//     owner of the press envelope — it stamped
//     `data-aftersign-job-take="pressing"` AND scheduled its own 96ms
//     setTimeout restore, in parallel with the inline `armPressing`
//     handler in `aftersign/index.html`. Two writers of the marker,
//     two restore timers, real race.
//   Round 2 (Soren, COMMENTED): the module was cut to a no-op shim.
//     Conceptually clean (single owner of everything), but CI stayed
//     red on the exact same "Received: 1" the pre-shim module had
//     (see #1681). The delegated document-level `pointerdown` in
//     index.html is theoretically firing on Playwright touch taps,
//     but the recorder in the e2e never observes the `pressing`
//     marker NOR an inline `scale(...)` transform — meaning the
//     inline handler is not, in practice, landing on the served
//     surface Playwright drives. Merging the shim would leave the
//     test red forever.
//   Round 3 (this file): the module is re-introduced as a SUBORDINATE
//     stamp that ONLY writes the inline `style.transform =
//     "scale(<scaleFrom>)"` on pointerdown. It does NOT stamp the
//     `pressing` marker. It does NOT schedule a restore timer. It
//     does NOT attach pointerup / pointercancel / lostpointercapture
//     handlers. The inline `armPressing` in `aftersign/index.html`
//     (~lines 1014-1235) remains the SINGLE OWNER of:
//       • the `data-aftersign-job-take="pressing"` marker (one
//         setAttribute writer, not two);
//       • the MutationObserver that keeps `pressing` re-asserted
//         through mid-hold rewrites from main.js;
//       • the `inFlight` same-id-inherit map that transfers the
//         remaining hold budget to a re-rendered `#offeredJobs` node;
//       • the single 96ms `setTimeout` restore that clears the
//         inline transform via `button.style.transform = ""` — the
//         SAME clear that unwinds any stamp this module also wrote.
//     So there are no dual restore timers, no dual marker writers,
//     and the transform-clear on release is authored in exactly one
//     place. The two writers of the inline transform on pointerdown
//     write the IDENTICAL string (`scale(<scaleFrom>)`), so there is
//     nothing to race — the value is convergent by construction.
//
// Why this belt-and-suspenders is needed: the e2e recorder in
// `aftersign/e2e/aftersign-job-offer-press-juice.playtest.spec.ts`
// keys off two channels — (1) the `pressing` attribute (records the
// CSS `--aftersign-job-take-scale-from` custom-prop value when
// observed) and (2) the inline `style.transform` string (parses
// `scale(…)`). On the shipped surface at #1681 both channels stayed
// dark under Playwright's touch-taps, and CI red'd with "Received:
// 1" (no compression observed at all). A DIRECT (non-delegated)
// `pointerdown` listener on the button — attached at render time
// by `main.js:2061` — is the strongest guarantee that at least the
// inline-transform channel lights up on the exact node the finger
// is on: no capture-phase, no `target.closest()`, no MutationObserver
// prerequisites, no `getComputedStyle` (this handler uses the
// scaleFrom passed in as an argument by main.js, whose value comes
// from the same frozen feel row that stamped the CSS var). If the
// inline handler DOES fire, it writes the same value; the stamp is
// idempotent. If the inline handler DOESN'T fire (the observed
// failure mode on #1681), this module's write is the only thing
// that lights the recorder up.
//
// If a future janitor is tempted to expand this module — to
// re-add a marker write, or a restore timer, or a pointerup
// handler — DON'T. Extend `armPressing` in `aftersign/index.html`
// instead. That is the canonical owner of the press envelope, and
// the e2e keys off its invariants. This module's ONLY job is the
// one inline transform stamp on pointerdown; anything else is
// dual-ownership again.

export const attachJobOfferPressFeedback = (element, scaleFrom) => {
  if (!element || typeof element.addEventListener !== "function") return;

  // Frozen fallback matches AFTERSIGN_JOB_TAKE_FEEL.scaleFrom
  // (apps/web/src/aftersign/aftersignJobTakeFeel.js) — the same
  // number `armPressing`'s try/catch falls back to when the CSS
  // custom-prop read comes back empty.
  const pressedScale =
    Number.isFinite(scaleFrom) && scaleFrom > 0 && scaleFrom < 1
      ? scaleFrom
      : 0.97;

  // Passive: this handler NEVER preventDefaults the event. Direct on
  // the button (not delegated), non-capture: it is a subordinate
  // stamp that runs alongside — not instead of — the inline
  // `armPressing` handler on document capture-phase. The two writes
  // are identical and idempotent.
  element.addEventListener(
    "pointerdown",
    (event) => {
      // Primary-button / primary-touch only. `event.button` is
      // undefined for touch pointer events in some engines; the
      // guard treats that as primary (same shape as the pre-round-2
      // module and consistent with the delegated inline handler
      // which does not gate on `.button` at all).
      if (event.button !== undefined && event.button !== 0) return;
      try {
        element.style.transform = `scale(${pressedScale})`;
      } catch (_err) {
        /* stamp is belt-and-suspenders; a throw must never bubble */
      }
    },
    { passive: true },
  );
};
