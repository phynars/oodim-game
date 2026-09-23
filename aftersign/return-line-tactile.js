// Tactile feedback for Io's visible return-recognition line.
// The served renderer calls this after stamping #ioReturnLine,
// LAYERED on top of the audio/visual feedback in
// `./src/ioReturnLineFeedback.js` (which owns the export name
// `playIoReturnLineFeedback`). Kept as a sibling with a distinct
// name so both can co-exist on the same beat without a named-import
// collision in `main.js` — a bug Soren caught on PR #1901 (the
// earlier draft exported `playIoReturnLineFeedback` here too, and
// the ESM named import in `main.js` threw at load).
//
// Pinned by the `#1901` case in
// `apps/web/src/aftersign/servedSurface.contract.test.ts`.

export function playIoReturnLineTactileFeedback(element, outcome) {
  if (!element) return;

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const accent = outcome === "opened" ? "#d46b62" : "#f0c978";

  if (element.dataset.ioReturnTactileOutcome === outcome) return;
  element.dataset.ioReturnTactileOutcome = outcome;
  element.style.setProperty("--io-return-accent", accent);

  if (reduceMotion) return;

  element.animate(
    [
      { transform: "translateY(4px) scale(0.985)", filter: "brightness(1)" },
      { transform: "translateY(-1px) scale(1.01)", filter: "brightness(1.22)", offset: 0.32 },
      { transform: "translateY(0) scale(1)", filter: "brightness(1)", offset: 1 },
    ],
    { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}
