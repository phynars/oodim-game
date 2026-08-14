// Cached, subscription-based reader for the OS/browser
// `prefers-reduced-motion` preference. Wraps `window.matchMedia`
// so the render loop can consult a plain function every frame
// without allocating a new MediaQueryList per call — and, more
// importantly, so a live toggle in DevTools ("Emulate CSS media
// feature: prefers-reduced-motion") flips the answer mid-run via
// the media query's `change` event (which is how flagship QA
// verifies the accessibility path).
//
// The CSS half of this contract already exists — index.html:402
// gates the failure-sting overlay's shake keyframes under
// `@media (prefers-reduced-motion: reduce)`. The JS half is what
// this factory feeds: `failureStingEnvelopeAt(elapsedMs, feel,
// { reducedMotion })` zeroes wobble + all wobble-derived channels
// (see aftersign/src/failureStingFeedback.ts §"Reduced motion
// keeps the acknowledgement flash..."), and both call sites in
// main.js (tick + computeCameraPoseAt) pass `read()` through.
//
// SSR / jsdom safety: any window without `matchMedia` (Node's
// pure-runner, an older jsdom without the polyfill) resolves to
// "not reduced" and never subscribes to change events. This keeps
// the boot path safe for the pure/typecheck bundles that import
// main.js transitively.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const createReducedMotionPreference = (windowObject = typeof window === "undefined" ? undefined : window) => {
  if (!windowObject || typeof windowObject.matchMedia !== "function") {
    // No matchMedia in this environment (SSR, Node harness). Answer
    // "not reduced" forever; the update escape hatch stays available
    // for tests that want to force the flag on without a real query.
    let reducedMotion = false;
    return {
      read: () => reducedMotion,
      update: (nextValue) => {
        reducedMotion = Boolean(nextValue);
      },
    };
  }

  let mediaQuery;
  try {
    mediaQuery = windowObject.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    // A throwing matchMedia (some legacy embedded browsers) still
    // must not crash the boot path — degrade to the inert reader.
    let reducedMotion = false;
    return {
      read: () => reducedMotion,
      update: (nextValue) => {
        reducedMotion = Boolean(nextValue);
      },
    };
  }

  let reducedMotion = mediaQuery.matches === true;

  const read = () => reducedMotion;
  const update = (nextValue) => {
    reducedMotion = Boolean(nextValue);
  };

  const onChange = (event) => {
    update(event?.matches ?? mediaQuery.matches);
  };

  // Modern browsers expose addEventListener on MediaQueryList; older
  // Safari (< 14) only exposes the deprecated addListener. Try the
  // modern shape first, fall back to the legacy shape, and if neither
  // is available (a stub in a harness), just skip subscription — the
  // initial `.matches` read still answers correctly for that frame.
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(onChange);
  }

  return { read, update };
};
