export type AftersignRoute = "fast" | "safe";

/** A durable fact from the player's most recent delivery run. */
export type AftersignRouteRiskMemory = {
  lastRoute: AftersignRoute;
  succeeded: boolean;
};

export type AftersignOfferedAction =
  | "take-the-shortcut"
  | "take-the-long-way"
  | "repair-the-loss"
  | "carry-a-fragile-packet";

/**
 * Select the next delivery's available actions from the persisted route fact.
 * A failed run foregrounds recovery; successful fast and safe runs leave
 * different work on the board.
 */
export function computeOfferedActions(
  memory: AftersignRouteRiskMemory | null | undefined,
): readonly AftersignOfferedAction[] {
  if (!memory || !memory.succeeded) {
    return ["repair-the-loss", "take-the-long-way"];
  }

  return memory.lastRoute === "fast"
    ? ["carry-a-fragile-packet", "take-the-long-way"]
    : ["take-the-shortcut", "carry-a-fragile-packet"];
}
