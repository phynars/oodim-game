import { ioReturnLine } from "./ioVoice.js";

/**
 * Resolve the player-facing return-memory line from the delivery outcome.
 * Unknown and malformed outcomes intentionally fall through to ioVoice's
 * defensive default rather than leaving the recognition beat silent.
 *
 * @param {"sealed" | "opened" | "unknown" | undefined | null} outcome
 * @returns {string}
 */
export const ioReturnLineForDeliveryOutcome = (outcome) => ioReturnLine(outcome);
