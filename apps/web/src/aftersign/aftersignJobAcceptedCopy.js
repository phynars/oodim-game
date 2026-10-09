// Io's job-acceptance acknowledgement line — the beat Io speaks the
// instant a player taps `#job-offer-<jobId>` at `packet-offered`.
//
// SCOPE — what this module owns, and what it does NOT:
//   • It does NOT own the offer itself. `selectMloopJobCopy` and
//     `getMloopAvailableAction` in `aftersign/mloop-copy.js` are the
//     authorial home of the offered `label` + memory-gated
//     `mloop-*` action id — those drive the shipped
//     `#job-offer-<jobId>` button's visible text and
//     `data-aftersign-job-take-action` axis.
//   • It DOES own the FOLLOW-UP acknowledgement Io speaks the instant
//     the fork commits, keyed on the jobId the player just took.
//     Narratively distinct from the button label: the label names the
//     available work; this line confirms the choice landed and keeps
//     the loop open.
//   • It does NOT own the packet-button label or the route-choice
//     button labels on a round-2 red-tag second packet. The
//     packet-button label is set by `commitPacketOutcome` in
//     `aftersign/main.js` (override pins `#packetButton.textContent`
//     to "Red tag — Saint Orra" when `state.delivery.id === "red-tag"`
//     — see `aftersign/e2e/red-tag-packet-choice-retention.spec.ts`
//     for the live-tapped contract). The route-choice button labels
//     are authored by `aftersignJobOfferCopy.js` (one row per memory
//     branch, each carrying `safeRouteLabel` + `riskyRouteLabel`) and
//     resolved for a given state's offer-copy by
//     `routeRiskActionLabelForOffer()` in `routeRiskActionLabels.js`
//     (the SHIPPED wire of that resolver into main.js's second
//     `renderRouteRiskChoice({...})` call site is tracked in
//     follow-up issue #2245 — this PR ships only the pure resolver
//     plus its consumer test, deliberately split so each diff stays
//     reviewable).
//     Both surfaces live outside this module on purpose: an
//     acceptance acknowledgement is NOT a selectable route, so a
//     renderer that mistakes one for the other will read the wrong
//     table.
//
// Consumer contract (why this module is not orphaned — Mara's
// REQUEST_CHANGES on PR #1884 was correct: an unrendered copy string
// is not player-visible evidence, and the e2e that asserted it against
// an untouched `#line` reded honestly):
//   1. `apps/web/src/aftersign/aftersignJobAcceptedRender.ts` — the
//      served-page DOM writer that stamps the selected line into a
//      NEW sibling paragraph `<p id="jobTakeAckLine">` right after
//      `#line`. Sibling, not overwrite — `#line`'s textContent is
//      owned by the beat dialogue table in `ioRecognitionDialogue.ts`
//      (contract-pinned by `io-phone-ready-look-sound-contract.spec.ts`
//      on `lineText`). Same discipline as PR #1874's
//      `#ioSecondPacketPointer`.
//   2. `apps/web/src/aftersign/aftersignJobAcceptedRender.consumer.test.ts`
//      — jsdom-mount consumer test asserting the writer stamps the
//      sibling paragraph with the exact copy this module authors.
//   3. `aftersign/main.js` — wires the transient `jobTakeAckJobId`
//      state through `choose()` (which fires on the offer tap) and
//      calls the render stamp inside `renderText()`.
//   4. `aftersign/e2e/aftersign-job-take-feel.playtest.spec.ts` —
//      tap-driven Playwright spec that plays a phone viewport through
//      `packet-offered`, taps the safe-delivery offer, and asserts
//      the rendered line lands on `#jobTakeAckLine`.

// Per-jobId acknowledgement line. Keys are the same jobIds authored
// in `aftersign/mloop-copy.js` (`MLOOP_JOB_COPY_BY_ID`) so a new job
// authored there without a line here falls back to DEFAULT_LINE and
// never renders template-token leakage.
const JOB_ACCEPTED_LINE_BY_JOB_ID = Object.freeze({
  "job-safe-delivery":
    "The lit stair, then. Keep the seal closed. I will remember you as careful.",
  "job-sealed-return":
    "Take it back sealed. If the box refuses it, bring the refusal to me. I remember who kept faith.",
  "job-private-ledger":
    "A private ledger leaves no clean hands. Bring yours back. I remember what you chose to carry.",
  "job-night-transfer":
    "Cross after the bell. Do not mistake the quiet for permission. I will remember you took the dark.",
  "job-signed-receipt":
    "Get it in ink. A promise is lighter when someone has to carry it. I remember who made it answer.",
  "job-low-risk-errand":
    "Stay where the light can find you. Bring back what it lets you keep. I remember caution.",
  "job-redemption-route":
    "Pay it back. The account is still open because I left it open. I remember who returned.",
});

const DEFAULT_LINE =
  "Take the job. Keep the return open — I will remember what you bring back.";

export const AFTERSIGN_JOB_ACCEPTED_COPY = JOB_ACCEPTED_LINE_BY_JOB_ID;

/**
 * Return the acknowledgement line Io speaks the instant the player
 * commits to the given jobId. Unknown / non-string / missing jobId
 * falls back to the generic default — the beat still fires, no
 * template-token leak. Frozen table so a render caller cannot
 * mutate the copy under the frame.
 *
 * @param {unknown} jobId
 * @returns {string}
 */
export function aftersignJobAcceptedLine(jobId) {
  if (typeof jobId !== "string") return DEFAULT_LINE;
  return JOB_ACCEPTED_LINE_BY_JOB_ID[jobId] ?? DEFAULT_LINE;
}

// Exposed for tests that want to enumerate the authored jobIds
// without probing internal shape.
export const AFTERSIGN_JOB_ACCEPTED_JOB_IDS = Object.freeze(
  Object.keys(JOB_ACCEPTED_LINE_BY_JOB_ID),
);
