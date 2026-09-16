// Audio half of the job-offer confirmation. Keep this tiny, data-first, and
// importable so the served runtime can schedule the same short cue that the
// pressed offer button visibly acknowledges.
export const JOB_OFFER_CONFIRM_AUDIO = Object.freeze({
  cue: "job-offer-selected",
  frequencyHz: 196,
  attackMs: 12,
  durationMs: 120,
  peakGain: 0.08,
  waveform: "triangle",
});
