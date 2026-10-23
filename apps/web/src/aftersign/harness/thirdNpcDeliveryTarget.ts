export const THIRD_NPC_RED_TAG_TARGET_SELECTOR =
  '[data-aftersign-delivery-target="red-tag-recipient"]';

/**
 * Binds the third NPC's red-tag delivery target to its state recorder.
 * The target is deliberately a normal clickable element so served-surface
 * tests and players use the same pointer path.
 */
export function bindThirdNpcRedTagDeliveryTarget(
  doc: Document | undefined,
  deliver: () => void,
): void {
  const target = doc?.querySelector<HTMLElement>(
    THIRD_NPC_RED_TAG_TARGET_SELECTOR,
  );
  if (!target || target.dataset.aftersignDeliveryBound === "true") {
    return;
  }

  target.dataset.aftersignDeliveryBound = "true";
  target.addEventListener("click", deliver);
}
