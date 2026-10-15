export const FLAGSHIP_BEAT_MIGRATIONS = Object.freeze({
  "packet-kept-sealed": "packet-choice",
  "packet-opened": "packet-choice",
  "io-returning-recognition": "io-return-recognition",
});

export const canonicalFlagshipBeat = (beat) => {
  if (typeof beat !== "string") {
    return beat;
  }
  return FLAGSHIP_BEAT_MIGRATIONS[beat] || beat;
};

/**
 * Shared restore guard for ANY beat loaded from a persisted save, used
 * by BOTH restore paths:
 *   - cold-boot hydration at `aftersign/main.js` state-literal init
 *     (reached by a real `page.reload()` and by first-load with an
 *     authoritative save),
 *   - `reloadFromSave` (reached only via `input.forceReload`).
 *
 * Why one helper, not two call-site conditionals: a save written by
 * pre-#2324 code can carry `beat="packet-delivered"` while
 * `packet.delivered === false` — the player was mid route-choice,
 * but the older build labelled the choice screen with the later
 * beat id. Restoring that contradictory pair projects the
 * post-delivery "I ran early / I listened / Return to Io" recognition
 * fork over a player who never delivered. The guard remaps the one
 * invalid persisted shape back to `packet-choice`; every other
 * persisted beat passes through canonicalization unchanged.
 *
 * @param {{ savedBeat: unknown, packetDelivered: boolean, fallback?: string }} args
 * @returns {string}
 */
export const restoreFlagshipBeat = ({
  savedBeat,
  packetDelivered,
  fallback = "packet-offered",
}) => {
  const canonical =
    typeof savedBeat === "string" ? canonicalFlagshipBeat(savedBeat) : fallback;
  if (canonical === "packet-delivered" && !packetDelivered) {
    return "packet-choice";
  }
  return canonical;
};
