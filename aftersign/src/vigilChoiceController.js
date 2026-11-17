const VIGIL_CHOICE_SELECTOR = [
  'button[data-choice-id="meet-orra"]:not([disabled])',
  'button[data-choice-id="light-vigil"]:not([disabled])',
  'button[data-choice-id="spare-vigil"]:not([disabled])',
  'button[data-choice-id="carry-red-tag-to-saint-orra"]:not([disabled])',
].join(", ");

const VIGIL_CHOICE_IDS = new Set([
  "meet-orra",
  "light-vigil",
  "spare-vigil",
  "carry-red-tag-to-saint-orra",
]);

/**
 * Routes enabled vigil choice taps through the canonical choice dispatcher.
 *
 * @param {{document: Document, choose: (choiceId: string) => Promise<unknown> | unknown, applyTapConfirmFeel: (choiceId: string) => void}} options
 * @returns {() => void} Removes the delegated listener.
 */
export function attachVigilChoiceController({
  document,
  choose,
  applyTapConfirmFeel,
}) {
  const onClick = (event) => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;

    const vigilButton = target.closest(VIGIL_CHOICE_SELECTOR);
    if (!vigilButton) return;

    const vigilId = vigilButton.getAttribute("data-choice-id");
    if (!VIGIL_CHOICE_IDS.has(vigilId)) return;

    applyTapConfirmFeel(vigilId);
    void choose(vigilId);
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
