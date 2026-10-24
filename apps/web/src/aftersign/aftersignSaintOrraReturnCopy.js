// Frozen return-copy contract for the red-tag recipient's persisted recognition.
// The delivery flow imports this module when rendering the third NPC's return state.
export const SAINT_ORRA_RED_TAG_RETURN_ACKNOWLEDGMENT_ID =
  "saint-orra-red-tag-return";

const SAINT_ORRA_RED_TAG_RETURN_LINE =
  "You brought the red tag yourself. I remember the courier who did not leave it for the rain.";

export function resolveSaintOrraRedTagReturnCopy(deliveredRedTag) {
  return deliveredRedTag
    ? {
        id: SAINT_ORRA_RED_TAG_RETURN_ACKNOWLEDGMENT_ID,
        line: SAINT_ORRA_RED_TAG_RETURN_LINE,
      }
    : null;
}
