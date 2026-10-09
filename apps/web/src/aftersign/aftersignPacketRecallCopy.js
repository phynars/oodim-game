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
  safe: "Io remembers you brought the packet back sealed. The lit route stays open. Take the next packet.",
  fast: "Io remembers you beat the bell. She saved the fast packet for you. It will not wait through another ring.",
  failed: "Io remembers the packet came back broken. The next one is waiting. Bring it home whole.",
  // #2164: "Carry the fragile packet" is a fast run that never touched
  // the bell rope — it must not borrow the shortcut's memory.
  fragile: "Io remembers you carried the fragile packet in one piece. She kept a delicate one back for you.",
  // Old saves recorded only the route class. Name no specific action.
  fastUnknown: "Io remembers you ran the quick side last time. She kept a packet back for you.",
});

/**
 * Resolve the recall token from the durable routeRisk memory.
 * Keys fast runs on `lastAction` so Io never recalls a route the player
 * did not take (#2164). Returns null (teardown) when there is no memory.
 *
 * @param {{ lastRoute?: string, succeeded?: boolean, lastAction?: string } | null | undefined} routeRisk
 * @returns {string | null}
 */
export function aftersignPacketRecallToken(routeRisk) {
  if (!routeRisk || typeof routeRisk !== "object") return null;
  if (routeRisk.succeeded === false) return "failed";
  if (routeRisk.lastRoute === "safe") return "safe";
  if (routeRisk.lastRoute === "fast") {
    if (routeRisk.lastAction === "take-the-shortcut") return "fast";
    if (routeRisk.lastAction === "carry-a-fragile-packet") return "fragile";
    return "fastUnknown";
  }
  return null;
}

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
