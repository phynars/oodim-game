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
 * Normalizes a persisted flagship beat before either boot-time hydration or
 * an in-session reload projects it into the composed game state.
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

  if (canonical === "packet-delivered") {
    return packetDelivered ? "io-return-recognition" : "packet-choice";
  }

  return canonical;
};
