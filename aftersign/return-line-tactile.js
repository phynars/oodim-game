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
// `apps/web/src/aftersign/servedSurface.contract.test.ts`, and by
// the tap-driven witness on `data-io-return-tactile-outcome` in
// `aftersign/e2e/io-voice-served.spec.ts` (both branches).
//
// AI006 — CSS consumer for the stamped custom property.
// `--io-return-accent` is stamped on `#ioReturnLine.style` per
// outcome. To keep it from being dead-on-arrival (Soren's AI006
// block on PR #1901, matching the tap-confirm precedent that
// requires a CSS consumer rule for every stamped custom property),
// this module also injects an idempotent stylesheet — same shape
// as `aftersign/src/kioskSceneVisual.js::ensureStyle` — whose one
// rule paints `#ioReturnLine`'s left accent stripe from
// `var(--io-return-accent)`. Player-visible: a warm/amber vertical
// stripe on the return paragraph after a SEALED tap, a deeper
// red-orange after an OPENED pull. Removing the stamp = the stripe
// falls back to `transparent`; changing the outcome = the stripe
// swaps color mid-frame.

const STYLE_ID = "aftersign-return-line-tactile-style";

function ensureAccentStyle(doc) {
  if (!doc || typeof doc.getElementById !== "function") return null;
  const existing = doc.getElementById(STYLE_ID);
  if (existing) return existing;
  if (typeof doc.createElement !== "function" || !doc.head) return null;

  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.dataset.aftersignReturnLineTactile = "true";
  // Consumer for the `--io-return-accent` custom property stamped
  // below. Fallback to `transparent` keeps the paragraph clean
  // off-beat (when the writer hasn't stamped yet or the dataset
  // guard resets it).
  style.textContent = `
    #ioReturnLine {
      border-left: 2px solid var(--io-return-accent, transparent);
      padding-left: .5rem;
      transition: border-left-color 180ms cubic-bezier(0.22, 1, 0.36, 1);
    }
  `;
  doc.head.append(style);
  return style;
}

export function playIoReturnLineTactileFeedback(element, outcome) {
  if (!element) return;

  // Idempotency gate FIRST — renderText() re-arms every frame, so
  // the same outcome must not repeatedly re-inject styles or
  // re-trigger the animation. Mirrors the guard in
  // `ioReturnLineFeedback.js`.
  if (element.dataset.ioReturnTactileOutcome === outcome) return;

  // AI006 — mount the CSS consumer before stamping the custom
  // property, so the first stamp is already being read by a rule.
  const doc = element.ownerDocument;
  ensureAccentStyle(doc);

  const accent = outcome === "opened" ? "#d46b62" : "#f0c978";
  element.dataset.ioReturnTactileOutcome = outcome;
  element.style.setProperty("--io-return-accent", accent);

  // Reduced-motion guard: some environments (older browsers, jsdom
  // in unit tests, headless Playwright with a stubbed window) have
  // no `matchMedia` at all — `window.matchMedia?.()` still throws
  // in that case because optional-chaining a call only guards the
  // property, not the return-value's `.matches` access, and a fresh
  // `MediaQueryList` shape is not guaranteed. Explicitly probe the
  // function shape before calling it. AI-minor on PR #1901.
  const mm =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const reduceMotion = mm ? mm.matches === true : false;

  if (reduceMotion) return;
  if (typeof element.animate !== "function") return;

  element.animate(
    [
      { transform: "translateY(4px) scale(0.985)", filter: "brightness(1)" },
      { transform: "translateY(-1px) scale(1.01)", filter: "brightness(1.22)", offset: 0.32 },
      { transform: "translateY(0) scale(1)", filter: "brightness(1)", offset: 1 },
    ],
    { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}
