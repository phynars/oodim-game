// Live, per-read reader for the OS/browser `prefers-reduced-motion`
// preference. Wraps `window.matchMedia` so the render loop can consult
// a plain function every frame.
//
// LOAD-ORDER GOTCHA (Soren, PR #1688 review):
// Playwright's `reducedMotion: 'reduce'` emulation is applied via CDP
// AFTER the page's initial script bundles start evaluating, so any
// reader that captured `mediaQuery.matches` at MODULE-LOAD time saw
// `false` and never flipped — even though the media query itself
// updates live. The `change` event fires asynchronously after
// emulation lands, but the first render frame (which is what our
// e2e sampler sees) can run before that listener has fired.
//
// Fix: `read()` consults `mediaQuery.matches` LIVE on every call.
// MediaQueryList#matches is a live getter — it reflects the current
// emulated/OS value every time, no listener plumbing required.
// Cost is negligible (one property read per frame) and it removes
// an entire class of load-order flake from CI + DevTools emulation.
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
    let forcedReducedMotion = false;
    return {
      read: () => forcedReducedMotion,
      update: (nextValue) => {
        forcedReducedMotion = Boolean(nextValue);
      },
    };
  }

  let mediaQuery;
  try {
    mediaQuery = windowObject.matchMedia(REDUCED_MOTION_QUERY);
  } catch {
    // A throwing matchMedia (some legacy embedded browsers) still
    // must not crash the boot path — degrade to the inert reader.
    let forcedReducedMotion = false;
    return {
      read: () => forcedReducedMotion,
      update: (nextValue) => {
        forcedReducedMotion = Boolean(nextValue);
      },
    };
  }

  // Optional manual override — tests that don't route through a real
  // matchMedia (unit specs constructing the reader directly) can force
  // a value via `update(true)`. When forced, we return the forced value
  // instead of the live query result. `null` = no override, defer to
  // matchMedia. This preserves the prior `update()` contract without
  // re-introducing module-load caching for the normal render path.
  let forcedValue = null;

  const read = () => {
    if (forcedValue !== null) return forcedValue;
    // Live read — reflects the current emulated/OS value every call,
    // so Playwright's CDP-emulated `reducedMotion: 'reduce'` is
    // observed on the very first frame regardless of when it landed
    // relative to module-load.
    try {
      return mediaQuery.matches === true;
    } catch {
      // MediaQueryList throwing on `.matches` is exotic but has been
      // seen in old embedded WebKits — degrade to "not reduced" to
      // match the inert-reader branch.
      return false;
    }
  };

  const update = (nextValue) => {
    forcedValue = Boolean(nextValue);
  };

  return { read, update };
};
