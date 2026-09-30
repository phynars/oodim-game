// Io's remembered route line, rendered after a delivery resolves.
//
// The served scene selects one of these exact lines from the durable route-risk
// fact: safe, fast, or failed. Keep this surface small: the route's consequence
// belongs in the moment the player returns, not in a retrospective explanation.
export const AFTERSIGN_PACKET_RECALL_COPY = Object.freeze({
  safe: "You kept to the light. The packet arrived dry. I noticed.",
  fast: "You took the dark cut. The packet beat the bell. I noticed.",
  failed: "The bell caught you. It catches everyone once. I noticed.",
});
