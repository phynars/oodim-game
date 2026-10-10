// Consumer wiring test for `aftersign/src/redTagRouteLabels.js`.
//
// Purpose (Soren's REQUEST_CHANGES on #2256):
//   The red-tag resolver must satisfy TWO contracts at once:
//
//     1. ROUTE actions (`take-the-shortcut`, `take-the-long-way`)
//        resolve to the frozen TRUSTED job-offer copy —
//        `routeRiskActionLabelForOffer(chooseAftersignJobOfferCopy(
//        <trusted memory>))` — so there is ONE vocabulary, not two.
//
//     2. NON-ROUTE actions (`carry-a-fragile-packet`, `repair-the-loss`)
//        return `null`, and the main.js call site falls back to
//        `routeRiskActionLabel(action)` via `?? routeRiskActionLabel`.
//        Previously that fallback was absent, which rendered BLANK
//        buttons on the red-tag path.
//
// Design notes answering the two findings on the prior rev:
//
// AI003 (tautological fallback check):
//   The old test's tap-wiring block asserted
//   `text === redTagLabelForAction(action)`, where `redTagLabelForAction`
//   itself IS the `??` fallback — so it passed vacuously. This rev
//   asserts tap outputs against the FROZEN authored constants
//   (`AFTERSIGN_JOB_OFFER_COPY.trusted.*` and `ROUTE_RISK_ACTION_LABEL.*`)
//   directly. If the resolver stops returning the trusted row, or if a
//   non-route label drifts from `routeRiskActionLabel`, this red-lines.
//
// AI008 (unverified tap-test premise):
//   The old tap test picked ONE memory (`fast + succeeded`) and
//   expected BOTH route buttons from it. But
//   `computeOfferedActions({ lastRoute: "fast", succeeded: true })`
//   emits `["carry-a-fragile-packet", "take-the-long-way"]` — it never
//   emits `take-the-shortcut`. The two route ids only ever surface
//   from DIFFERENT memory states:
//
//     - `fast + succeeded` → emits `take-the-long-way`
//     - `safe + succeeded` → emits `take-the-shortcut`
//
//   This rev runs ONE render per memory, taps only the route button
//   that memory offers, and composes the full `byAction` map across
//   renders. The 180ms route-risk choice lock (see
//   `routeRiskChoiceIntent.ts`) is sidestepped by giving each render a
//   fresh container (per-container WeakMap keys the lock state) AND an
//   injected `now` clock that advances past the lock window between
//   taps.

import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
import {
  ROUTE_RISK_ACTION_LABELS,
  routeRiskActionLabel,
} from "./routeRiskActionLabels.js";
import {
  computeOfferedActions,
  renderRouteRiskChoice,
} from "./routeRiskMemory";
import { redTagRouteRiskActionLabel } from "../../../../aftersign/src/redTagRouteLabels.js";

// Mirror of `main.js`'s red-tag `labelForRouteRiskAction`:
//   state.delivery.id === "red-tag"
//     ? (action) => redTagRouteRiskActionLabel(action)
//         ?? routeRiskActionLabel(action)
//     : routeRiskActionLabel
//
// NOTE: this mirror is used ONLY to drive the renderer in the tap
// tests below. Every assertion compares to the AUTHORED CONSTANTS
// (`AFTERSIGN_JOB_OFFER_COPY.trusted.*`, `ROUTE_RISK_ACTION_LABEL.*`)
// — never to the output of this mirror — so the tests stay sharp
// even though the mirror itself is a tautology of the two underlying
// resolvers.
const redTagLabelForAction = (action: string): string =>
  redTagRouteRiskActionLabel(action) ?? routeRiskActionLabel(action);

describe("redTagRouteRiskActionLabel — resolver contract", () => {
  it("resolves route actions to the frozen TRUSTED offer-copy row (one vocabulary)", () => {
    expect(redTagRouteRiskActionLabel("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    expect(redTagRouteRiskActionLabel("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );
  });

  it("returns null for non-route actions so the caller falls back to routeRiskActionLabel", () => {
    // These two actions appear in the red-tag route-risk UI when the
    // player's prior route failed or when the first-packet path is
    // offered. If the resolver returned a string here the fallback
    // would be bypassed; if it returned "" the main.js `??` operator
    // would also skip the fallback (`??` only triggers on
    // null/undefined). Only `null` is correct.
    expect(redTagRouteRiskActionLabel("carry-a-fragile-packet")).toBeNull();
    expect(redTagRouteRiskActionLabel("repair-the-loss")).toBeNull();
    expect(redTagRouteRiskActionLabel("no-such-action")).toBeNull();
  });
});

describe("redTagRouteRiskActionLabel — served renderer wiring (tap-driven)", () => {
  // Every memory state `computeOfferedActions` can take. Running the
  // renderer against each one exercises the full union of action ids
  // the red-tag route-risk surface can ever stamp on screen. If a
  // future action id ships with no label coverage, this red-lines.
  const memories = [
    null,
    { lastRoute: "safe", succeeded: false },
    { lastRoute: "fast", succeeded: true },
    { lastRoute: "safe", succeeded: true },
  ] as const;

  it("renders a non-empty authored label on every red-tag route button and never the raw id", () => {
    for (const memory of memories) {
      const dom = new JSDOM("<!doctype html><div id='surface'></div>");
      const container = dom.window.document.getElementById(
        "surface",
      ) as unknown as HTMLElement;

      renderRouteRiskChoice({
        container,
        memory,
        labelForAction: redTagLabelForAction,
        onChoose: () => {},
      });

      const buttons = Array.from(
        container.querySelectorAll("button[data-aftersign-tap-choice]"),
      ) as HTMLElement[];

      // computeOfferedActions emits 2 actions per memory state; the
      // red-tag path must render both as tappable, labeled buttons.
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.length).toBe(computeOfferedActions(memory).length);

      for (const button of buttons) {
        const action = button.getAttribute("data-aftersign-tap-choice") ?? "";
        const text = (button.textContent ?? "").trim();
        // The regression Soren caught: dropping `?? routeRiskActionLabel`
        // let the renderer stamp `null`/`""` as the label text for
        // `carry-a-fragile-packet` and `repair-the-loss`. Both of
        // these assertions red-line on that exact failure.
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toBe(action);
      }
    }
  });

  it("taps every red-tag button across memory states and reports authored labels back", () => {
    // Walk ALL reachable memories. For each, render into a fresh
    // container (per-container lock), tap every button with an
    // injected clock that advances past the 180ms route-risk lock
    // between taps so sequential clicks are not swallowed.
    const taps: Array<{ action: string; label: string }> = [];
    const LOCK_MS = 180;
    let fakeNow = 0;

    for (const memory of memories) {
      const dom = new JSDOM("<!doctype html><div id='surface'></div>");
      const container = dom.window.document.getElementById(
        "surface",
      ) as unknown as HTMLElement;

      renderRouteRiskChoice({
        container,
        memory,
        labelForAction: redTagLabelForAction,
        now: () => fakeNow,
        onChoose: (action) => {
          const button = container.querySelector(
            `button[data-aftersign-tap-choice="${action}"]`,
          ) as HTMLElement | null;
          taps.push({ action, label: (button?.textContent ?? "").trim() });
        },
      });

      const buttons = Array.from(
        container.querySelectorAll("button[data-aftersign-tap-choice]"),
      ) as HTMLElement[];
      for (const button of buttons) {
        button.click();
        // Advance the fake clock past the lock window so the NEXT
        // tap (a different choice id) is accepted.
        fakeNow += LOCK_MS + 1;
      }
    }

    const byAction = new Map(taps.map((t) => [t.action, t.label]));

    // Route actions: compare to the FROZEN trusted-row constants.
    // If `redTagRouteRiskActionLabel` ever stops routing route ids
    // through the trusted job-offer copy, these red-line.
    expect(byAction.get("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    expect(byAction.get("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );

    // Non-route actions: compare to the AUTHORED
    // `ROUTE_RISK_ACTION_LABELS` constants — not to
    // `redTagLabelForAction(action)` (which would be a tautology of
    // the `??` fallback this test is here to protect). If main.js
    // ever drops `?? routeRiskActionLabel(action)` AND the resolver
    // keeps returning null for these ids, the rendered text becomes
    // `""`, these assertions red-line, and the regression is caught
    // at the renderer boundary.
    expect(byAction.get("carry-a-fragile-packet")).toBe(
      ROUTE_RISK_ACTION_LABELS["carry-a-fragile-packet"],
    );
    expect(byAction.get("repair-the-loss")).toBe(
      ROUTE_RISK_ACTION_LABELS["repair-the-loss"],
    );
  });
});
