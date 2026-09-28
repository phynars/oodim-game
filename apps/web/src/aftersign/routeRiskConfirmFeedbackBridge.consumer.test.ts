// Consumer test for the route-risk confirm-feedback bridge.
//
// Drives the SERVED `renderRouteRiskChoice` writer against a real
// jsdom container with the bridge wired, taps a rendered button, and
// pins:
//   1. The bridge invokes `playFeedback(container)` on the tray the
//      writer stamped — matching the "the tray the player just used"
//      contract from `aftersign/src/routeRiskConfirmFeedback.js`.
//   2. The underlying `onChoose` still fires — the durable route
//      commit is not gated on the decorative feedback.
//   3. A throwing `playFeedback` does not prevent the durable commit —
//      the outer try/catch in the bridge is load-bearing.
//   4. A null container is forwarded to `playFeedback` as null (never
//      swallowed) and the commit still runs.
//
// This is a SERVED-SURFACE consumer: it imports the real
// `renderRouteRiskChoice` from `routeRiskMemory.ts` so a future
// refactor that unwires the bridge reds on the same render path the
// served `aftersign/main.js` uses — not a jsdom-only fixture.

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  renderRouteRiskChoice,
  type AftersignOfferedAction,
} from "./routeRiskMemory.ts";
import { wrapRouteRiskChoiceOnChoose } from "./routeRiskConfirmFeedbackBridge.ts";

function makeContainer(): HTMLElement {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="routeRiskChoice" data-aftersign-route-risk-surface></div></body></html>`,
  );
  const container = dom.window.document.getElementById(
    "routeRiskChoice",
  ) as HTMLElement;
  return container;
}

describe("wrapRouteRiskChoiceOnChoose (route-risk press bridge)", () => {
  it("plays the confirmation envelope on the tray BEFORE delegating to onChoose", () => {
    const container = makeContainer();
    const commits: AftersignOfferedAction[] = [];
    const feedbackSurfaces: (HTMLElement | null | undefined)[] = [];
    const playFeedback = vi.fn((surface: HTMLElement | null | undefined) => {
      feedbackSurfaces.push(surface);
      // At the moment feedback fires, the durable commit must not have
      // run yet — this is the "played before delegate" ordering the
      // served surface relies on so the WAAPI KeyframeEffect exists
      // before any re-render of the tray on commit.
      expect(commits).toEqual([]);
      return true;
    });

    renderRouteRiskChoice({
      container,
      memory: null, // cold → ["repair-the-loss", "take-the-long-way"]
      onChoose: wrapRouteRiskChoiceOnChoose({
        container,
        onChoose: (action) => commits.push(action),
        playFeedback,
      }),
    });

    const button = container.querySelector<HTMLButtonElement>(
      'button[data-aftersign-tap-choice="take-the-long-way"]',
    );
    expect(button).not.toBeNull();
    button!.click();

    expect(playFeedback).toHaveBeenCalledTimes(1);
    expect(feedbackSurfaces).toEqual([container]);
    expect(commits).toEqual(["take-the-long-way"]);
  });

  it("still commits when playFeedback throws (decorative feedback cannot block durable commit)", () => {
    const container = makeContainer();
    const commits: AftersignOfferedAction[] = [];
    const playFeedback = vi.fn(() => {
      throw new Error("simulated WAAPI failure");
    });

    renderRouteRiskChoice({
      container,
      memory: null,
      onChoose: wrapRouteRiskChoiceOnChoose({
        container,
        onChoose: (action) => commits.push(action),
        playFeedback,
      }),
    });

    const button = container.querySelector<HTMLButtonElement>(
      'button[data-aftersign-tap-choice="take-the-long-way"]',
    );
    expect(button).not.toBeNull();
    expect(() => button!.click()).not.toThrow();

    expect(playFeedback).toHaveBeenCalledTimes(1);
    expect(commits).toEqual(["take-the-long-way"]);
  });

  it("forwards a null container to playFeedback and still commits", () => {
    const container = makeContainer();
    const commits: AftersignOfferedAction[] = [];
    const feedbackSurfaces: (HTMLElement | null | undefined)[] = [];
    const playFeedback = vi.fn((surface: HTMLElement | null | undefined) => {
      feedbackSurfaces.push(surface);
      return false;
    });

    renderRouteRiskChoice({
      container,
      memory: null,
      onChoose: wrapRouteRiskChoiceOnChoose({
        container: null,
        onChoose: (action) => commits.push(action),
        playFeedback,
      }),
    });

    const button = container.querySelector<HTMLButtonElement>(
      'button[data-aftersign-tap-choice="take-the-long-way"]',
    );
    expect(button).not.toBeNull();
    button!.click();

    expect(playFeedback).toHaveBeenCalledTimes(1);
    expect(feedbackSurfaces).toEqual([null]);
    expect(commits).toEqual(["take-the-long-way"]);
  });
});
