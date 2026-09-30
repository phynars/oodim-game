// Durable route-recall copy for Io's packet-offered return beat.
// `aftersign/main.js` resolves the prior route token and renders the exact
// line through `aftersignPacketRecallLine()`.
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  safe: "You kept to the light. The packet arrived dry. I remember.",
  fast: "You took the dark cut. The packet beat the bell. I noticed.",
  failed: "The bell caught you. It knows your step now. I do too.",
});

/**
 * Return Io's authored recall for a durable route token.
 * Unknown or absent tokens deliberately render no recall.
 *
 * @param {unknown} token
 * @returns {string}
 */
export function aftersignPacketRecallLine(token) {
  if (typeof token !== "string") return "";
  return AFTERSIGN_PACKET_RECALL_COPY[token] ?? "";
}

// Exposed for tests that enumerate authored tokens without relying on object
// shape.
export const AFTERSIGN_PACKET_RECALL_TOKENS = Object.freeze(
  Object.keys(AFTERSIGN_PACKET_RECALL_COPY),
);
