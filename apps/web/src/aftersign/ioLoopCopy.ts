import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

export type AftersignIoLoopCopy = Readonly<{
  safeJobLabel: string;
  returnLine: string;
}>;

const FIRST_RUN = Object.freeze({
  safeJobLabel: "Take the safe job",
  returnLine: "Bring it back sealed. We can talk when you're through.",
}) satisfies AftersignIoLoopCopy;

const TRUSTED_RUN = Object.freeze({
  safeJobLabel: "Take another safe job",
  returnLine: "You kept the seal. I have another quiet route for you.",
}) satisfies AftersignIoLoopCopy;

const DISTRUSTED_RUN = Object.freeze({
  safeJobLabel: "Take the careful job",
  returnLine: "You opened it. This one stays in sight until you return.",
}) satisfies AftersignIoLoopCopy;

/** Resolves Io's repeat-job copy from the packet outcome recorded by the slice. */
export function getAftersignIoLoopCopy(
  state: AftersignVerticalSliceState,
): AftersignIoLoopCopy {
  if (state.packetOutcome === "sealed") {
    return TRUSTED_RUN;
  }
  if (state.packetOutcome === "opened") {
    return DISTRUSTED_RUN;
  }
  return FIRST_RUN;
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
