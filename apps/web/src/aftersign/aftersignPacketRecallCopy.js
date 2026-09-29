// Io's packet-recall line — spoken at the NEXT `packet-offered` beat
// after the player has already run at least one delivery in this save
// record. This is the mechanic's whole point: memory made audible.
// Io names the route the player ran LAST TIME, beside (not inside)
// the beat-owned dialogue line at `#line`.
//
// SCOPE — what this module owns, and what it does NOT:
//   • It does NOT own the offer buttons at `packet-offered`. That
//     axis is `mloop-copy.js` (memory-gated `MLOOP_JOB_COPY_BY_ID`
//     entries) and is asserted end-to-end by
//     `aftersign/e2e/m-loop-e1-two-round-playtest.spec.ts`.
//   • It does NOT own the base beat line at `#line`. That is owned
//     by the beat dialogue table in `ioRecognitionDialogue.ts` and
//     is contract-pinned by
//     `io-phone-ready-look-sound-contract.spec.ts` on `lineText`.
//   • It DOES own the recall follow-up Io speaks the frame the beat
//     re-enters `packet-offered` on a save record that carries a
//     completed prior route. Same discipline as PR #1874's
//     `#ioSecondPacketPointer` and PR #1884's `#jobTakeAckLine`:
//     a NEW sibling paragraph, never an overwrite.
//
// Consumer contract (why this module is not orphaned — Soren's
// REQUEST_CHANGES on PR #2012 was correct: importing a symbol whose
// source doesn't exist is a red-branch failure, not a copy edit):
//   1. `apps/web/src/aftersign/aftersignPacketRecallRender.ts` — the
//      served-page DOM writer that stamps this line into a NEW
//      sibling paragraph `<p id="packetRecallLine">` right after
//      `#line`.
//   2. `apps/web/src/aftersign/aftersignPacketRecallRender.consumer.test.ts`
//      — jsdom-mount consumer test that pins the sibling paragraph
//      to the exact copy this module authors.
//   3. `aftersign/main.js` — derives the token from
//      `state.player.routeRisk` (`{ lastRoute, succeeded }`) at
//      `packet-offered` and calls `stampPacketRecallLine`.
//   4. `aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts` —
//      tap-driven Playwright spec that plays a phone viewport
//      through round 1's safe delivery, loops back to
//      `packet-offered`, and asserts the recalled "safe" line
//      renders on `#packetRecallLine` as a visible sibling of
//      `#line`.

// The three tokens the recall speaks to. Keyed on the `routeRisk`
// shape carried on `state.player.routeRisk` in the aftersign runtime
// (`{ lastRoute: "safe" | "fast", succeeded: boolean }`) — a failed
// run collapses to the "failed" line regardless of which route was
// attempted, because Io reads the outcome, not the intent.
const PACKET_RECALL_LINE_BY_TOKEN = Object.freeze({
  safe: "Last time you kept to the lit stair. The seal came back whole. I remember careful hands.",
  fast: "Last time you cut through the dark. It let you pass. I remember quick hands.",
  failed: "Last time the dark took its due. You came back anyway. I remember the cost.",
});

export const AFTERSIGN_PACKET_RECALL_COPY = PACKET_RECALL_LINE_BY_TOKEN;

/**
 * Return the recall line Io speaks the frame the beat re-enters
 * `packet-offered` on a save record that carries a prior run.
 *
 * Contract: returns the authored line for a KNOWN token
 * (`"safe" | "fast" | "failed"`), or an empty string when the token
 * is unrecognised. Empty string (not `null`) so the render caller
 * can pass the result straight into `stampPacketRecallLine` without
 * a nullability dance — the render writer treats `null` as the
 * teardown signal and does not use the string when the token is
 * `null`. Same discipline as `aftersignRouteOutcomeCopy.js` returning
 * `null` for an unknown token: never silently mis-credit the player.
 *
 * @param {unknown} token
 * @returns {string}
 */
export function aftersignPacketRecallLine(token) {
  if (typeof token !== "string") return "";
  return PACKET_RECALL_LINE_BY_TOKEN[token] ?? "";
}

// Exposed for tests that want to enumerate the authored tokens
// without probing internal shape.
export const AFTERSIGN_PACKET_RECALL_TOKENS = Object.freeze(
  Object.keys(PACKET_RECALL_LINE_BY_TOKEN),
);
