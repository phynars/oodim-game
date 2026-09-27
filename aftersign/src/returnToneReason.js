const RETURN_TONE_REASONS = new Set(["kind", "evasive", "blunt"]);

/**
 * Read a valid return-tone posture from the rendered control the player
 * touched. Invalid or absent DOM data deliberately falls back to evasive,
 * matching the story's existing defensive default.
 */
export const returnToneReasonFromTarget = (target) => {
  const reason = target?.dataset?.returnReason;
  return RETURN_TONE_REASONS.has(reason) ? reason : "evasive";
};
