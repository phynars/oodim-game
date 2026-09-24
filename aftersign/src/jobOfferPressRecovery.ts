export type JobOfferBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Returns true only when a post-press element is the same visual offer that
 * received the tap. A beat transition may reuse an id for a newly-laid-out
 * offer; its position must not be treated as press-animation recovery.
 */
export function isSameJobOfferRecovery(
  before: JobOfferBounds,
  after: JobOfferBounds,
  maxSizeChangeRatio = 0.03,
): boolean {
  if (before.width <= 0 || before.height <= 0 || after.width <= 0 || after.height <= 0) {
    return false;
  }

  return (
    Math.abs(1 - after.width / before.width) <= maxSizeChangeRatio &&
    Math.abs(1 - after.height / before.height) <= maxSizeChangeRatio
  );
}
