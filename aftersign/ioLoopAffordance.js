/**
 * Mounts Io's repeat-job affordance. The return line is deliberately
 * revealed by the player's button click rather than a harness-only input.
 */
export function renderAftersignIoLoopAffordance(container, copy) {
  const { safeJobLabel, returnLine } = copy;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = safeJobLabel;
  button.addEventListener("click", () => {
    const returnLineElement = document.createElement("p");
    returnLineElement.textContent = returnLine;
    container.replaceChildren(button, returnLineElement);
  });
  container.replaceChildren(button);
  return button;
}
