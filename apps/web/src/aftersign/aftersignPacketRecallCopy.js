// Durable route-recall copy for Io's packet-offered return beat.
// `aftersign/main.js` resolves the prior route token and renders the
// exact line through `aftersignPacketRecallLine()` into the sibling
// `#packetRecallLine` paragraph next to `#line`.
//
// Writer's rule (pinned by `aftersignPacketRecallRender.consumer.test.ts`):
// an UNKNOWN or ABSENT token returns `""`. The render seam treats that
// as a teardown — a missing/corrupt route must tear down the paragraph,
// not render a false "safe" memory. Do NOT fall back to a default line.
// `safe` keeps the pinned substring "brought the packet back sealed" so
// `aftersignPacketRecallRender.consumer.test.ts` stays green across copy
// edits — the test asserts that phrase, not the whole line.
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  safe: "Io remembers you brought the packet back sealed. The lit route is still yours; take the next packet.",
  fast: "Io remembers you beat the bell. The next packet is yours if you move before it rings.",
  failed: "Io remembers the packet came back wrong. She kept the repair job for you.",
});

/**
 * Return Io's authored recall for a durable route token.
 * Unknown or absent tokens deliberately render no recall (teardown).
 *
 * @param {unknown} token
 * @returns {string}
 */
export function aftersignPacketRecallLine(token) {
  if (typeof token !== "string") return "";
  return AFTERSIGN_PACKET_RECALL_COPY[token] ?? "";
}

// Exposed for tests / harness code that enumerate authored tokens
// without reaching into the frozen object shape.
export const AFTERSIGN_PACKET_RECALL_TOKENS = Object.freeze(
  Object.keys(AFTERSIGN_PACKET_RECALL_COPY),
);
