// Job-offer choice feedback — MAIN.JS-FACING WRAPPER around the shipped
// `apps/web/src/aftersign/ioJobOfferActionFeel.ts` writer.
//
// Soren's PR #1890 REQUEST_CHANGES was two-part:
//
//   1. Vocabulary mismatch: `getJobOfferChoiceFeedback` cased on
//      `"safe"/"risky"` while the call site passes `offer.routeRisk`
//      (`"low"/"medium"/"high"` — `packages/aftersign/src/computeOfferedJobs.ts`).
//      Fix: route through `aftersignRouteRiskToJobTone`, the single
//      source-of-truth translator.
//
//   2. The APPLIED half was dead on arrival: the previous draft stamped
//      `--aftersign-job-choice-*` custom properties + `data-aftersign-
//      job-choice-*` dataset attributes that NO served CSS reads, and
//      ran a `filter: brightness()` keyframe with no asserted outcome.
//      No rendered effect, no trip-wire.
//
// Both are fixed by DELETING the parallel envelope and delegating to
// the writer the served surface already owns:
//
//   • `applyAftersignJobOfferActionFeel(button, tone)` stamps
//     `data-aftersign-job-risk` + the seven `--aftersign-job-offer-*`
//     custom properties. Those attributes/vars are READ by the CSS
//     block `installAftersignJobOfferActionFeelStyles` mounts into
//     `<head>` — the `[data-aftersign-job-risk]` selector drives real
//     `transform` / `box-shadow` / `border-color` transitions, and
//     the `.is-aftersign-job-offer-pressing` class the wrapper below
//     toggles produces the pressed-scale outcome a Playwright /
//     jsdom test can `expect(...).toHaveCSS(...)` against.
//
//   • The vocabulary flows `routeRisk` → `aftersignRouteRiskToJobTone`
//     → `AftersignJobRiskTone` (`safe | risky | consequence`), which
//     is the ONLY vocabulary the shipped feel table understands.
//     Rename a tone in one place, both this wrapper and the writer
//     red in lockstep.
//
// The consumer test at
// `apps/web/src/aftersign/jobOfferChoiceFeedback.consumer.test.ts`
// drives THIS module through jsdom and asserts the rendered outcome
// (installed <style>, stamped attributes, CSS var values matching
// the shipped `AFTERSIGN_JOB_OFFER_ACTION_FEEL` row, and the
// pressed-class round-trip).

import { aftersignRouteRiskToJobTone } from "../../apps/web/src/aftersign/aftersignRouteRiskToJobTone.ts";
import {
  AFTERSIGN_JOB_OFFER_ACTION_FEEL,
  AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
  applyAftersignJobOfferActionFeel,
  installAftersignJobOfferActionFeelStyles,
} from "../../apps/web/src/aftersign/ioJobOfferActionFeel.ts";

/**
 * Pure resolver: `routeRisk` → the feel envelope the shipped writer
 * will stamp. Kept as a named export so pure tests can pin the axis
 * without a DOM, and so the tone translation is visible in one place.
 *
 * The three axes below are the ONLY `routeRisk` values that ever reach
 * the served offer button (see `packages/aftersign/src/computeOfferedJobs.ts::OFFER_BY_ID`).
 * Anything else is collapsed to `"safe"` by the translator.
 */
export function getJobOfferChoiceFeedback(routeRisk) {
  const tone = aftersignRouteRiskToJobTone(routeRisk);
  return { tone, ...AFTERSIGN_JOB_OFFER_ACTION_FEEL[tone] };
}

/**
 * Apply the choice-feedback envelope to `button`. Runs at click-time
 * from `armJobOfferFeel(button, () => { … })` in `aftersign/main.js`
 * so the acknowledgment lands on the exact rendered element the
 * player just tapped, in the same input frame.
 *
 * Effect on the DOM (all rendered, all testable):
 *
 *   1. `installAftersignJobOfferActionFeelStyles(root)` mounts the
 *      shipped CSS block if it isn't already there (idempotent per
 *      document — the served page's boot may not have installed it,
 *      so we install-on-first-use here for safety).
 *   2. `applyAftersignJobOfferActionFeel(button, tone)` stamps
 *      `data-aftersign-job-risk` + the seven `--aftersign-job-offer-*`
 *      CSS variables. The installed `[data-aftersign-job-risk]` rule
 *      then owns `transform` / `box-shadow` / `border-color`
 *      transitions off those vars — real rendered feel, not a
 *      keyframe with no consumer.
 *   3. Toggle `AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS` on for
 *      `feel.durationMs`. The installed `.is-aftersign-job-offer-
 *      pressing` rule reads `--aftersign-job-offer-press-scale` and
 *      applies `transform: translateY(0) scale(var(--...))` — the
 *      player sees a physical acknowledgement pinned to their exact
 *      button before the audio unlock, persistence, or beat advance
 *      can defer the response.
 */
export function applyJobOfferChoiceFeedback(button, routeRisk) {
  if (!button) return null;

  const tone = aftersignRouteRiskToJobTone(routeRisk);
  const ownerDocument =
    button.ownerDocument ||
    (typeof document !== "undefined" ? document : null);
  if (ownerDocument) {
    installAftersignJobOfferActionFeelStyles(ownerDocument);
  }

  const feel = applyAftersignJobOfferActionFeel(button, tone);

  // Trigger the pressed-transform outcome the installed CSS reads.
  // The `armJobOfferFeel` callback fires on `click` — pointerdown /
  // pointerup have already resolved by then, so no other owner is
  // toggling the class. We hold it for the shipped `durationMs` so
  // the CSS transition has time to play, then clear.
  if (button.classList && typeof button.classList.add === "function") {
    button.classList.add(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS);
    const clear = () => {
      button.classList.remove(AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS);
    };
    const scheduler =
      typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout
        : typeof setTimeout === "function"
          ? setTimeout
          : null;
    if (scheduler) {
      scheduler(clear, feel.durationMs);
    } else {
      // No timer host (e.g. SSR / bare Node runners): clear
      // synchronously rather than leak the pressed marker.
      clear();
    }
  }

  return { tone, ...feel };
}
