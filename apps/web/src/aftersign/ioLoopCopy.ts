import { ioOfferCopyFor } from "../../../../aftersign/src/ioLoopCopy.js";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

export type AftersignIoLoopCopy = Readonly<{
  safeJobLabel: string;
  returnLine: string;
}>;

/** Typed adapter for the state-model surface; literals live in AFTERSIGN. */
export function getAftersignIoLoopCopy(
  state: AftersignVerticalSliceState,
): AftersignIoLoopCopy {
  const { safeJobLabel, returnLine } = ioOfferCopyFor(state.packetOutcome);
  return Object.freeze({ safeJobLabel, returnLine });
}

/**
 * Mounts Io's repeat-job affordance. The return line is deliberately
 * revealed by the player's button click rather than a harness-only input.
 */
export function renderAftersignIoLoopAffordance(
  container: HTMLElement,
  copy: AftersignIoLoopCopy,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = copy.safeJobLabel;
  button.addEventListener("click", () => {
    const returnLine = document.createElement("p");
    returnLine.textContent = copy.returnLine;
    container.replaceChildren(button, returnLine);
  });
  container.replaceChildren(button);
  return button;
}
