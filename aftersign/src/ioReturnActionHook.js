/**
 * Stable, player-visible return-action seam.
 *
 * The served renderer dispatches this event exactly when the player commits
 * a return posture at Io's recognition beat. Feel modules may subscribe
 * without owning the story transition or rewriting the choice handler.
 */
export const IO_RETURN_ACTION_EVENT = "aftersign:io-return-action";

/**
 * @param {"kind" | "evasive" | "blunt"} reason
 * @param {EventTarget | null | undefined} target
 * @returns {boolean}
 */
export function dispatchIoReturnAction(reason, target = document) {
  if (!target || typeof target.dispatchEvent !== "function") return false;
  if (reason !== "kind" && reason !== "evasive" && reason !== "blunt") {
    return false;
  }
  target.dispatchEvent(
    new CustomEvent(IO_RETURN_ACTION_EVENT, {
      bubbles: true,
      detail: Object.freeze({ reason }),
    }),
  );
  return true;
}
