// Played-not-driven spec for the M-LOOP-E1 route-risk tap-lock.
//
// Blocking review on PR #1925 (Soren): `routeRiskChoiceIntent.ts`
// shipped as a pure module with zero importers and no tap-driven
// assertion — dead-on-arrival. This spec closes both halves:
//
//   1. WIRED — imports the SERVED `renderRouteRiskChoice` and
//      renders into a real jsdom container. The lock lives inside
//      the writer's click handler; if a refactor unwires it, the
//      "second tap inside 180ms confirms the wrong route" case
//      reds here.
//
//   2. TAP-DRIVEN — every assertion fires from a real `.click()`
//      on a visible button, not from calling the pure lock
//      primitives directly. The clock is injected so the 180ms
//      window is deterministic.
//
// What the feel guard prevents:
//   The tray reflows after a chosen action (the offered-action set
//   changes). A finger that lifts off the original button 60ms
//   later can land on whatever button now occupies the same screen
//   space and confirm the WRONG route. The 180ms lock drops that
//   second tap. A same-button re-tap inside the window is idempotent
//   (the player pressed twice — don't punish that).

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ROUTE_RISK_CHOICE_LOCK_MS,
  isRouteRiskChoiceLocked,
  lockRouteRiskChoice,
  pickRouteRiskChoiceOnTap,
} from "./routeRiskChoiceIntent";
import {
  AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE,
  renderRouteRiskChoice,
  type AftersignOfferedAction,
} from "./routeRiskMemory";

const setupSurface = () => {
  const dom = new JSDOM(
    `<!doctype html><html><body><div id="host"></div></body></html>`,
  );
  const host = dom.window.document.getElementById("host") as HTMLElement;
  return { dom, host };
};

describe("routeRiskChoice tap-lock (played-not-driven — real .click() on rendered buttons)", () => {
  let dom: JSDOM;
  let host: HTMLElement;
  let clockMs: number;

  beforeEach(() => {
    ({ dom, host } = setupSurface());
    clockMs = 1_000;
  });

  afterEach(() => {
    dom.window.close();
  });

  const renderFreshRun = (
    onChoose: (action: AftersignOfferedAction) => void,
  ) => {
    // Fresh player (null memory) → two visible tappable options.
    renderRouteRiskChoice({
      container: host,
      memory: null,
      onChoose,
      now: () => clockMs,
    });
  };

  const clickAction = (action: AftersignOfferedAction) => {
    const button = host.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="${action}"]`,
    ) as HTMLElement | null;
    if (!button) throw new Error(`no rendered button for ${action}`);
    button.click();
  };

  it("drops a second tap on a DIFFERENT choice inside the 180ms window", () => {
    const chosen: AftersignOfferedAction[] = [];
    renderFreshRun((action) => chosen.push(action));

    // Tap 1: player commits to repair-the-loss at t=1000ms.
    clickAction("repair-the-loss");

    // Tap 2, 60ms later: the tray was about to reflow; the finger
    // that lifted slid onto take-the-long-way. This is the exact
    // "wrong route confirmed" case the lock exists to prevent.
    clockMs += 60;
    clickAction("take-the-long-way");

    // Only the first tap survived.
    expect(chosen).toEqual(["repair-the-loss"]);
  });

  it("releases the lock after 180ms so an intentional second choice lands", () => {
    const chosen: AftersignOfferedAction[] = [];
    renderFreshRun((action) => chosen.push(action));

    clickAction("repair-the-loss");
    // One tick past release — the player waited past the confirm
    // animation and genuinely wants the other option.
    clockMs += ROUTE_RISK_CHOICE_LOCK_MS + 1;
    clickAction("take-the-long-way");

    expect(chosen).toEqual(["repair-the-loss", "take-the-long-way"]);
  });

  it("accepts a same-button re-tap inside the window as idempotent (don't punish extra pressure)", () => {
    const chosen: AftersignOfferedAction[] = [];
    renderFreshRun((action) => chosen.push(action));

    clickAction("repair-the-loss");
    // 40ms later the same finger taps the same button again — the
    // player pressed hard, or the touch registered twice. Their
    // intent is unchanged; the second tap should fire too.
    clockMs += 40;
    clickAction("repair-the-loss");

    expect(chosen).toEqual(["repair-the-loss", "repair-the-loss"]);
  });

  it("drops the wrong-choice tap AT the 60ms mark specifically — feel fix authored to a millisecond", () => {
    // Named pin for the exact scenario the reviewer flagged: a
    // finger that lifts 60ms after the first tap can visually
    // confirm the wrong route once the tray reflows. Keep this
    // spec on 60ms so a "fix" that shortens the lock below the
    // reflow window reds.
    const chosen: AftersignOfferedAction[] = [];
    renderFreshRun((action) => chosen.push(action));

    clickAction("repair-the-loss");
    clockMs += 60;
    clickAction("take-the-long-way");
    clockMs += 60;
    clickAction("take-the-long-way");

    // Both mis-taps at 60ms and 120ms dropped; the original choice
    // is the only one that fired.
    expect(chosen).toEqual(["repair-the-loss"]);
  });
});

describe("routeRiskChoice tap-lock — pure primitive sanity", () => {
  // Small pure-primitive pins so a refactor of the intent module
  // reds here BEFORE the played spec above starts drifting.

  it("lockRouteRiskChoice + isRouteRiskChoiceLocked expose the 180ms window", () => {
    const lock = lockRouteRiskChoice("repair-the-loss", 1_000);
    expect(lock.releaseAtMs - lock.lockedAtMs).toBe(ROUTE_RISK_CHOICE_LOCK_MS);
    expect(isRouteRiskChoiceLocked(lock, 1_000)).toBe(true);
    expect(isRouteRiskChoiceLocked(lock, 1_000 + ROUTE_RISK_CHOICE_LOCK_MS - 1)).toBe(true);
    expect(isRouteRiskChoiceLocked(lock, 1_000 + ROUTE_RISK_CHOICE_LOCK_MS)).toBe(false);
  });

  it("pickRouteRiskChoiceOnTap keeps the original lock on a mismatched tap", () => {
    const prior = lockRouteRiskChoice("repair-the-loss", 1_000);
    const { accepted, nextLock } = pickRouteRiskChoiceOnTap(
      prior,
      "take-the-long-way",
      1_050,
    );
    expect(accepted).toBe(false);
    expect(nextLock).toBe(prior);
  });

  it("pickRouteRiskChoiceOnTap re-arms after the window elapses", () => {
    const prior = lockRouteRiskChoice("repair-the-loss", 1_000);
    const { accepted, nextLock } = pickRouteRiskChoiceOnTap(
      prior,
      "take-the-long-way",
      1_000 + ROUTE_RISK_CHOICE_LOCK_MS,
    );
    expect(accepted).toBe(true);
    expect(nextLock.choice).toBe("take-the-long-way");
  });
});
