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
