// Io's remembered route line, rendered after a delivery resolves.
//
// The served scene selects one of these exact lines from the durable
// route-risk fact: safe, fast, or failed. Keep this surface small: the
// route's consequence belongs in the moment the player returns, not in
// a retrospective explanation.
//
// SCOPE — what this module owns, and what it does NOT:
//   • It does NOT own the offer buttons at `packet-offered`. That axis
//     is `mloop-copy.js` (memory-gated `MLOOP_JOB_COPY_BY_ID` entries).
//   • It does NOT own the base beat line at `#line`. That is owned by
//     the beat dialogue table in `ioRecognitionDialogue.ts`.
//   • It DOES own the recall follow-up Io speaks the frame the beat
//     re-enters `packet-offered` on a save record carrying a completed
//     prior route.
//
// Consumers (kept wired — Soren's REQUEST_CHANGES on #2034 was correct:
// deleting an exported reader while the consumer test and playtest
// still import it is a red-branch failure, not a copy edit):
//   1. `aftersignPacketRecallRender.consumer.test.ts` — jsdom-mount
//      consumer test that resolves the exact copy through
//      `aftersignPacketRecallLine(token)`.
//   2. `aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts` —
//      tap-driven Playwright spec that asserts the recalled "safe"
//      line renders on `#packetRecallLine`.
//   3. `aftersign/main.js` — derives the token from
//      `state.player.routeRisk` at `packet-offered` and stamps the line.
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  safe: "You kept to the light. The packet arrived dry. I noticed.",
  fast: "You took the dark cut. The packet beat the bell. I noticed.",
  failed: "The bell caught you. It catches everyone once. I noticed.",
});

/**
 * Return the recall line Io speaks the frame the beat re-enters
 * `packet-offered` on a save record that carries a prior run.
 *
 * Returns the authored line for a KNOWN token
 * (`"safe" | "fast" | "failed"`), or an empty string when the token is
 * unrecognised. Empty string (not `null`) so the render caller can pass
 * the result straight into `stampPacketRecallLine` without a nullability
 * dance — the render writer treats `null` as the teardown signal.
 *
 * @param {unknown} token
 * @returns {string}
 */
export function aftersignPacketRecallLine(token) {
  if (typeof token !== "string") return "";
  return AFTERSIGN_PACKET_RECALL_COPY[token] ?? "";
}

// Exposed for tests that want to enumerate the authored tokens without
// probing internal shape.
export const AFTERSIGN_PACKET_RECALL_TOKENS = Object.freeze(
  Object.keys(AFTERSIGN_PACKET_RECALL_COPY),
);
