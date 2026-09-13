/**
 * Shared contract for controls that must remain usable with a phone finger.
 *
 * The browser already provides the actual tap semantics; this module protects
 * the geometry and event filtering that production UI owners apply to those
 * controls. It deliberately has no synthetic-input path.
 */
export const MIN_PHONE_TAP_TARGET_PX = 44;

export type TouchInteractionCoverage = Readonly<{
  width: number;
  height: number;
  pointerType: string;
}>;

export function hasPhoneTapCoverage({
  width,
  height,
  pointerType,
}: TouchInteractionCoverage): boolean {
  return (
    pointerType === "touch" &&
    width >= MIN_PHONE_TAP_TARGET_PX &&
    height >= MIN_PHONE_TAP_TARGET_PX
  );
}

export function checkPhoneTapCoverage(): void {
  if (
    !hasPhoneTapCoverage({
      width: MIN_PHONE_TAP_TARGET_PX,
      height: MIN_PHONE_TAP_TARGET_PX,
      pointerType: "touch",
    })
  ) {
    throw new Error("A 44px touch control must be covered by the phone tap contract.");
  }

  if (
    hasPhoneTapCoverage({
      width: MIN_PHONE_TAP_TARGET_PX - 1,
      height: MIN_PHONE_TAP_TARGET_PX,
      pointerType: "touch",
    })
  ) {
    throw new Error("Controls narrower than 44px must not pass phone tap coverage.");
  }

  if (
    hasPhoneTapCoverage({
      width: MIN_PHONE_TAP_TARGET_PX,
      height: MIN_PHONE_TAP_TARGET_PX,
      pointerType: "mouse",
    })
  ) {
    throw new Error("Mouse events must not be mistaken for phone touch coverage.");
  }
}
