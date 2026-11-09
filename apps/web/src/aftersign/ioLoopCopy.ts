import { ioOfferCopyFor } from "../../../../aftersign/src/ioLoopCopy.js";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

export type AftersignIoLoopCopy = Readonly<{
  safeJobLabel: string;
  returnLine: string;
}>;

/**
 * Typed adapter for the state-model surface; literals live in AFTERSIGN.
 * The served affordance renderer lives in `aftersign/ioLoopAffordance.js`.
 */
export function getAftersignIoLoopCopy(
  state: AftersignVerticalSliceState,
): AftersignIoLoopCopy {
  const { safeJobLabel, returnLine } = ioOfferCopyFor(state.packetOutcome);
  return Object.freeze({ safeJobLabel, returnLine });
}
