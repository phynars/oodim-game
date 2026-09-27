// Consumer test for `aftersign/src/routeRiskConfirmFeedback.js` — the
// main.js-facing route-choice acknowledgement envelope that plays on
// the tapped route tray in the route-risk fork (imported by
// `aftersign/main.js` alongside `ROUTE_RISK_CONFIRM_FEEL`, see
// `aftersign/src/routeRiskMemory.ts:66-70`).
//
// PR #1976 re-review (Soren Vask). The first draft of this test lived
// at `aftersign/src/routeRiskConfirmFeedback.contract.test.ts` and
// tripped two blockers:
//   1. `aftersign/tsconfig.json` has `strict: true` with no `allowJs`
//      and `include: ["src"]`, so an `aftersign/src/*.test.ts` file
//      that imports `./routeRiskConfirmFeedback.js` reds `typecheck:
//      aftersign` with TS7016 (Ivy's own note in
//      `aftersign/src/packetChoiceIntentFeedback.ts` documents this
//      exact failure from PR #1902's AI008).
//   2. `test:unit:aftersign` runs `apps/web/src/aftersign/vitest.
//      config.ts`'s explicit `include` list from the repo root, and
//      that list is authored with `apps/web/src/aftersign/*` paths.
//      A file elsewhere in the tree is dead-on-arrival even if the
//      include entry names it.
//
// The mechanical fix is to co-locate this consumer test with every
// other sibling *Feel/*Feedback consumer test under
// `apps/web/src/aftersign/`, importing the served `.js` module via
// the deep relative path (`../../../../aftersign/src/*.js`) — the
// exact shape `jobOfferAcknowledgementFeel.consumer.test.ts` uses
// for a sibling `.js` feel module.
//
// Scope pinned here (matches `ROUTE_RISK_CONFIRM_FEEL` in
// `aftersign/src/routeRiskConfirmFeedback.js`):
//   1. `ROUTE_RISK_CONFIRM_FEEL` is the frozen contract the wire in
//      `aftersign/main.js` relies on — durationMs=180, liftPx=4,
//      scalePeak=1.025, cubic-bezier easing, 8ms haptic pulse.
//   2. `element.animate` is called with the three-keyframe non-
//      reduced-motion arc (rest → peak at offset 0.35 → rest), using
//      the shipped lift/scale tokens.
//   3. The animate options carry the shipped duration, easing,
//      `fill: "none"`, and `composite: "replace"` — the last is
//      load-bearing per the module's inline comment ("The pressed
//      tray must own this brief transform outright").
//   4. In-flight animations on the same surface are cancelled before
//      the confirmation beat starts (so a rapid re-tap on a route
//      tray never stacks two lifts).
//   5. Nullish / no-WAAPI surfaces return `false` and never throw —
//      the tap-commit path in main.js must never be blocked or
//      delayed by a decorative envelope.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ROUTE_RISK_CONFIRM_FEEL,
  playRouteRiskConfirmFeedback,
} from "../../../../aftersign/src/routeRiskConfirmFeedback.js";

describe("routeRiskConfirmFeedback (main.js consumer)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("exposes a frozen contract with the shipped duration/lift/scale/easing/haptic tokens", () => {
    // These are the values wired into main.js's route-choice callback
    // and pinned by `aftersign/src/routeRiskMemory.ts`'s header
    // comment. If any one drifts without this test being updated the
    // "route commit reads as a small, confident lift, never a lurch"
    // invariant breaks silently.
    expect(ROUTE_RISK_CONFIRM_FEEL).toEqual({
      durationMs: 180,
      liftPx: 4,
      scalePeak: 1.025,
      easing: "cubic-bezier(.2,.8,.2,1)",
      hapticPulseMs: 8,
    });
    expect(Object.isFrozen(ROUTE_RISK_CONFIRM_FEEL)).toBe(true);
  });

  it("calls surface.animate with the shipped three-keyframe arc and options", () => {
    const surface = document.createElement("div");
    document.body.append(surface);
    const animate = vi.fn();
    const getAnimations = vi.fn(() => []);
    (surface as unknown as { animate: typeof animate }).animate = animate;
    (surface as unknown as {
      getAnimations: typeof getAnimations;
    }).getAnimations = getAnimations;

    const scheduled = playRouteRiskConfirmFeedback(surface);
    expect(scheduled).toBe(true);
    expect(animate).toHaveBeenCalledTimes(1);

    const [keyframes, options] = animate.mock.calls[0]! as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];

    // Three keyframes — rest, peak at offset 0.35, rest. The 0.35
    // offset is the "confirmation lands sooner than the middle" cue
    // that separates this feel from a symmetric bump; if it drifts
    // to 0.5 the ack starts reading as sluggish.
    expect(keyframes).toHaveLength(3);

    // Rest keyframes: identity transform, brightness(1).
    expect(keyframes[0]!.transform).toBe("translate3d(0, 0, 0) scale(1)");
    expect(keyframes[0]!.filter).toBe("brightness(1)");
    expect(keyframes[2]!.transform).toBe("translate3d(0, 0, 0) scale(1)");
    expect(keyframes[2]!.filter).toBe("brightness(1)");

    // Peak keyframe: shipped liftPx and scalePeak tokens appear in
    // the transform (renaming the token here reds the test), and the
    // 0.35 offset is pinned exactly.
    expect(keyframes[1]!.transform).toBe(
      `translate3d(0, -${ROUTE_RISK_CONFIRM_FEEL.liftPx}px, 0) scale(${ROUTE_RISK_CONFIRM_FEEL.scalePeak})`,
    );
    expect(keyframes[1]!.filter).toBe("brightness(1.16)");
    expect(keyframes[1]!.offset).toBe(0.35);

    // Options: shipped duration + easing + fill:"none" +
    // composite:"replace". The last one is load-bearing (see the
    // module's inline comment — "the pressed tray must own this
    // brief transform outright"); dropping it lets ancestor
    // animations compose in and the 4px lift becomes a wandering
    // bump on successive route picks.
    expect(options).toEqual({
      duration: ROUTE_RISK_CONFIRM_FEEL.durationMs,
      easing: ROUTE_RISK_CONFIRM_FEEL.easing,
      fill: "none",
      composite: "replace",
    });
  });

  it("cancels any in-flight animations on the same surface before starting", () => {
    // Rapid re-tap on the route tray: the confirmation beat must NOT
    // pile on top of a still-running instance from the previous tap
    // — that would stack the -4px lifts and drift the tray off-
    // baseline while the second commit is still resolving.
    const surface = document.createElement("div");
    document.body.append(surface);
    const cancelA = vi.fn();
    const cancelB = vi.fn();
    const getAnimations = vi.fn(() => [{ cancel: cancelA }, { cancel: cancelB }]);
    const animate = vi.fn();
    (surface as unknown as {
      getAnimations: typeof getAnimations;
    }).getAnimations = getAnimations;
    (surface as unknown as { animate: typeof animate }).animate = animate;

    playRouteRiskConfirmFeedback(surface);

    expect(getAnimations).toHaveBeenCalledTimes(1);
    expect(cancelA).toHaveBeenCalledTimes(1);
    expect(cancelB).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("returns false when surface is nullish", () => {
    // Defensive path — same shape as the sibling feel modules. The
    // route-choice callback in main.js may call this before the tray
    // element ref is settled if a future refactor reorders writes.
    expect(playRouteRiskConfirmFeedback(null)).toBe(false);
    expect(playRouteRiskConfirmFeedback(undefined)).toBe(false);
    expect(() => playRouteRiskConfirmFeedback(null)).not.toThrow();
  });

  it("returns false when the browser has no Web Animations API", () => {
    // jsdom's HTMLElement has no `.animate` by default. Without an
    // explicit spy the module's `typeof surface.animate !== "function"`
    // guard fires — this asserts the guard, not the animation. The
    // route-commit path must never throw on a WAAPI-less browser
    // (older Safari, some WebViews); it just skips the visual ack.
    const surface = document.createElement("div");
    document.body.append(surface);
    // Sanity: jsdom really did not attach a WAAPI shim on this build.
    expect(
      typeof (surface as unknown as { animate?: unknown }).animate,
    ).not.toBe("function");

    expect(playRouteRiskConfirmFeedback(surface)).toBe(false);
  });

  it("returns false when the animate() call throws (partial WAAPI implementation)", () => {
    // The module's inline contract: `.animate(...)` is wrapped in
    // try/catch so a partial Web Animations implementation cannot
    // throw through to the tap-commit path in main.js. Feedback is
    // decorative; the route commit is durable and must not depend on
    // it. Pin the try/catch here so a future author who removes it
    // reds this test.
    const surface = document.createElement("div");
    document.body.append(surface);
    const animate = vi.fn(() => {
      throw new Error("partial WAAPI: play() unimplemented");
    });
    const getAnimations = vi.fn(() => []);
    (surface as unknown as { animate: typeof animate }).animate = animate;
    (surface as unknown as {
      getAnimations: typeof getAnimations;
    }).getAnimations = getAnimations;

    expect(playRouteRiskConfirmFeedback(surface)).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
  });
});
