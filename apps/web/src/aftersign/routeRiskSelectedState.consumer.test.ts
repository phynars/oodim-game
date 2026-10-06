// Served-surface tap-driven spec for the warm "selected" state the
// route-risk offered-action tray paints after a commit.
//
// Why this file exists (PR #2197 re-review, Soren blocked):
//   The first draft of the fix shipped a CSS block keyed on
//   `#routeChoice[data-aftersign-selected-action=…] button[data-aftersign-tap-choice=…]`,
//   but `main.js` stamps `data-aftersign-selected-action` on the
//   SIBLING container (`#routeRiskChoice`), not `#routeChoice`. The
//   two IDs host different fork controls:
//     - `#routeChoice`      → "I listened" / "I ran early" buttons.
//     - `#routeRiskChoice`  → the four offered-action buttons the
//       issue #2194 player tapped (take-the-shortcut,
//       take-the-long-way, repair-the-loss, carry-a-fragile-packet).
//   So the warm selected state never matched anything — the player's
//   "a chosen route turns into plain grey text" complaint persisted.
//
//   Soren's rule for this surface: a tap-driven playtest that checks
//   the selector actually resolves on the tapped button. This file
//   is that spec. It:
//
//     1. Loads the REAL served `aftersign/index.html` into jsdom.
//     2. Finds the shipped `#routeRiskChoice` container and renders
//        offered-action buttons into it via `renderRouteRiskChoice`.
//     3. Taps one rendered button, mirrors the `main.js` stamp
//        (`routeRiskChoice.dataset.aftersignSelectedAction = action`),
//        and asserts `.matches(…)` on the SHIPPED selected-state
//        selector — the tapped button must match; its siblings must
//        NOT. That's a selector-topology pin: the selected-state CSS
//        now lands on the exact button the finger pressed, not on a
//        parent node that doesn't exist in this subtree.
//     4. Pins the stylesheet itself: the served `<style>` block must
//        reference `#routeRiskChoice[data-aftersign-selected-action…]`,
//        not `#routeChoice[…]`. A regression that reverts the
//        selector reds here first.
//     5. Diverges across all four offered actions to prove the four
//        shipped rules are each addressable — not just the one the
//        first tap landed on.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (three.js + full scene graph).
//     The main.js dataset stamp is tiny; we mirror it inline, same
//     discipline as `routeRiskMemory.consumer.test.ts` and
//     `offeredJobsTapTargetFeel.consumer.test.ts`.
//   - Does NOT re-assert `computeOfferedActions` divergence — that
//     lives in `routeRiskMemory.consumer.test.ts` beside the writer.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE,
  renderRouteRiskChoice,
  type AftersignOfferedAction,
  type AftersignRouteRiskMemory,
} from "./routeRiskMemory";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

/**
 * The four offered actions the selected-state CSS has one rule per.
 * If this list diverges from `AftersignOfferedAction`, a new rule is
 * missing in `aftersign/index.html` and this test reds.
 */
const OFFERED_ACTIONS: readonly AftersignOfferedAction[] = [
  "take-the-shortcut",
  "take-the-long-way",
  "repair-the-loss",
  "carry-a-fragile-packet",
] as const;

const SELECTED_STATE_SELECTOR = (action: AftersignOfferedAction): string =>
  `#routeRiskChoice[data-aftersign-selected-action="${action}"] button[data-aftersign-tap-choice="${action}"]`;

describe("#routeRiskChoice warm selected-state selector topology (drives real aftersign/index.html)", () => {
  let dom: JSDOM;
  let routeRiskChoice: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
    const container = dom.window.document.querySelector("#routeRiskChoice");
    if (!(container instanceof dom.window.HTMLElement)) {
      throw new Error(
        "served aftersign/index.html must host a #routeRiskChoice container",
      );
    }
    routeRiskChoice = container as unknown as HTMLElement;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("stylesheet keys the selected-state rules on #routeRiskChoice, not the sibling #routeChoice", () => {
    // The exact failure Soren flagged on PR #2197: the first draft
    // of this slice keyed the rules on `#routeChoice`, which hosts
    // only "I listened" / "I ran early". main.js stamps the
    // selected-action dataset on `#routeRiskChoice`, so the rules
    // must key off `#routeRiskChoice`. Pin the stylesheet text so a
    // regression reverts the selector reds here first — before any
    // player-visible drift.
    const styleBlocks = Array.from(
      dom.window.document.querySelectorAll("style"),
    )
      .map((el) => el.textContent ?? "")
      .join("\n");

    for (const action of OFFERED_ACTIONS) {
      expect(
        styleBlocks,
        `served <style> must include a selected-state rule for ${action} keyed on #routeRiskChoice`,
      ).toContain(
        `#routeRiskChoice[data-aftersign-selected-action="${action}"] button[data-aftersign-tap-choice="${action}"]`,
      );
    }

    // Hard negative: no selected-state rule may key on #routeChoice
    // (the listened/ran-early sibling). This is the exact topology
    // bug the first draft shipped. If a future refactor re-adds a
    // rule keyed on #routeChoice[data-aftersign-selected-action=…]
    // this fires immediately. The negative lookahead `(?!Risk)` is
    // crucial — `#routeChoice` is a substring of `#routeRiskChoice`,
    // so a naive `/#routeChoice\[/` would false-positive on the
    // correct selector.
    expect(
      styleBlocks,
      "no selected-state rule may key on #routeChoice — that element doesn't host offered-action buttons",
    ).not.toMatch(/#routeChoice(?!Risk)\[data-aftersign-selected-action/);
  });

  it("after a tap, the stamped selected-action matches ONLY the tapped button via the shipped CSS selector", () => {
    // Mirror the main.js seam: after a commit, main.js writes
    //   routeRiskChoice.dataset.aftersignSelectedAction = action
    // and the stylesheet rules key off that attribute on the
    // container. The selector must resolve to the tapped button —
    // and only the tapped button — inside the rendered tray.
    const memory: AftersignRouteRiskMemory = {
      lastRoute: "safe",
      succeeded: true,
    };
    const chosen: AftersignOfferedAction[] = [];
    const rendered = renderRouteRiskChoice({
      container: routeRiskChoice,
      memory,
      onChoose: (action) => {
        chosen.push(action);
        // Mirror main.js: the container stamps the dataset after
        // the commit. The CSS reads from that attribute.
        routeRiskChoice.dataset.aftersignSelectedAction = action;
      },
    });

    // Safe + succeeded offers take-the-shortcut + carry-a-fragile-packet.
    expect(rendered).toEqual(["take-the-shortcut", "carry-a-fragile-packet"]);

    const tappedAction: AftersignOfferedAction = "take-the-shortcut";
    const tapped = routeRiskChoice.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="${tappedAction}"]`,
    ) as HTMLElement;
    expect(tapped, "expected a take-the-shortcut button on the rendered tray").not.toBeNull();

    tapped.click();

    // The tap routed through onChoose and the dataset landed on
    // the container — exactly what the main.js seam does.
    expect(chosen).toEqual([tappedAction]);
    expect(routeRiskChoice.dataset.aftersignSelectedAction).toBe(tappedAction);

    // The core topology assertion: the tapped button matches the
    // shipped selected-state CSS selector. This is the check the
    // broken `#routeChoice`-keyed selector failed — a jsdom
    // `.matches()` resolves against the live tree, so a wrong
    // parent-ID reds immediately.
    expect(
      tapped.matches(SELECTED_STATE_SELECTOR(tappedAction)),
      "tapped button must match the shipped selected-state selector",
    ).toBe(true);

    // The untapped sibling MUST NOT match any selected-state rule
    // — only the finger-pressed button lights up.
    const sibling = routeRiskChoice.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="carry-a-fragile-packet"]`,
    ) as HTMLElement;
    expect(sibling, "expected a carry-a-fragile-packet sibling").not.toBeNull();
    expect(
      sibling.matches(SELECTED_STATE_SELECTOR("carry-a-fragile-packet")),
      "untapped sibling must not match the selected-state selector",
    ).toBe(false);
    // And the tapped button must NOT match a sibling's rule — the
    // per-action pairing is tight (shortcut rule doesn't paint
    // long-way's button, etc.).
    expect(
      tapped.matches(SELECTED_STATE_SELECTOR("carry-a-fragile-packet")),
      "tapped button must not match a different action's selected-state rule",
    ).toBe(false);
  });

  it("the selected-state selector addresses each of the four offered actions — one rule per AftersignOfferedAction", () => {
    // Rotation pin: stamp the dataset for each action in turn, and
    // confirm the matching selector resolves to a rendered button
    // carrying that `data-aftersign-tap-choice`. Guards against a
    // partial rename that fixes three rules but misses one.
    for (const action of OFFERED_ACTIONS) {
      // Reset the tray with a memory that offers this action.
      // Fallback memory offers the recovery pair, which covers
      // repair-the-loss + take-the-long-way; the fast/safe success
      // branches cover the remaining two.
      let memory: AftersignRouteRiskMemory | null;
      if (action === "repair-the-loss" || action === "take-the-long-way") {
        memory = null; // → recovery set: [repair-the-loss, take-the-long-way]
      } else if (action === "take-the-shortcut") {
        memory = { lastRoute: "safe", succeeded: true };
      } else {
        memory = { lastRoute: "fast", succeeded: true };
      }

      // Clear the dataset + re-render for a clean per-action slice.
      delete routeRiskChoice.dataset.aftersignSelectedAction;
      renderRouteRiskChoice({
        container: routeRiskChoice,
        memory,
        onChoose: () => {},
      });

      const target = routeRiskChoice.querySelector(
        `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="${action}"]`,
      ) as HTMLElement | null;
      expect(
        target,
        `offered-action ${action} must land as a tappable button in at least one memory branch`,
      ).not.toBeNull();

      // Simulate the main.js post-tap stamp without actually
      // firing the click handler (we're testing selector reach,
      // not the lock-timing logic — that's pinned elsewhere).
      routeRiskChoice.dataset.aftersignSelectedAction = action;

      expect(
        target!.matches(SELECTED_STATE_SELECTOR(action)),
        `selected-state selector for ${action} must resolve to the rendered tap-choice button`,
      ).toBe(true);
    }
  });
});

describe("#routeRiskChoice label is player-facing — no dev jargon", () => {
  // Issue #2194 flagged "Route memory" as developer jargon that
  // leaked onto the served page; Soren's PR #2197 re-review flagged
  // the sibling tray's "Route risk" label in the same family.
  // Pin a player-facing label here so a regression that reintroduces
  // either dev-jargon term reds immediately.
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
  });

  afterEach(() => {
    dom.window.close();
  });

  it("the #routeRiskChoice label does not say 'Route risk' (dev jargon)", () => {
    const label = dom.window.document.querySelector(
      "#routeRiskChoice .route-choice-label",
    );
    expect(label, "served page must label the route-risk tray").not.toBeNull();
    const text = (label!.textContent ?? "").trim();
    expect(
      text.toLowerCase(),
      "the shipped label must not expose the 'Route risk' dev term — see issue #2194",
    ).not.toBe("route risk");
  });

  it("the #routeChoice label does not say 'Route memory' (dev jargon per issue #2194)", () => {
    const label = dom.window.document.querySelector(
      "#routeChoice .route-choice-label",
    );
    expect(label, "served page must label the kiosk-ack tray").not.toBeNull();
    const text = (label!.textContent ?? "").trim();
    expect(
      text.toLowerCase(),
      "the shipped label must not expose the 'Route memory' dev term — see issue #2194",
    ).not.toBe("route memory");
  });
});
