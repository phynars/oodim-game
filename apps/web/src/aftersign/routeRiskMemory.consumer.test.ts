// Tap-driven consumer spec for `computeOfferedActions` — proves the
// route/risk memory fact is a LIVE input to the rendered UI, not just
// a typed constant with a green compile.
//
// Blocking review on PR #1375 (Soren): a pure contract module with no
// wiring into the served surface and no tap-driven test is dead code
// with green types. This spec closes the gap by:
//
//   1. Mounting a real `[data-aftersign-route-risk-surface]` container
//      in a jsdom document.
//   2. Rendering the offered-action set for one memory fact
//      (fast + succeeded).
//   3. Dispatching a real `.click()` on one of the rendered
//      `[data-aftersign-tap-choice]` buttons — the same vocabulary the
//      shipped served surface already uses for committing taps.
//   4. Recording the new memory via `recordRouteRun` and re-rendering.
//   5. Asserting the offered-action button set DIVERGED between the
//      two runs — this is the M-LOOP-E1 acceptance criterion (a
//      route/risk choice this run changes the action set next run).
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` or load the shipped
//     `aftersign/index.html`. Mounting the container into the served
//     page is a follow-up (see the module's block comment) — this
//     spec exercises the module's own rendered UI shape, which is
//     the same DOM contract a served host would consume.

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE,
  AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE,
  computeOfferedActions,
  recordRouteRun,
  renderRouteRiskChoice,
  type AftersignOfferedAction,
  type AftersignRouteRiskMemory,
} from "./routeRiskMemory";

describe("routeRiskMemory rendered UI + tap-driven divergence", () => {
  let dom: JSDOM;
  let container: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM(
      `<!doctype html><html><body><div id="host"></div></body></html>`,
    );
    container = dom.window.document.getElementById("host") as HTMLElement;
  });

  afterEach(() => {
    dom.window.close();
  });

  const readRenderedActions = (): AftersignOfferedAction[] => {
    const buttons = Array.from(
      container.querySelectorAll(
        `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}]`,
      ),
    ) as HTMLElement[];
    return buttons.map(
      (el) =>
        el.getAttribute(AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE) as AftersignOfferedAction,
    );
  };

  it("stamps the container attribute + one tap-choice button per offered action", () => {
    // Fresh memory (a first run) has no prior fact — recovery set.
    renderRouteRiskChoice({
      container,
      memory: null,
      onChoose: () => {},
    });

    expect(container.hasAttribute(AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE)).toBe(
      true,
    );

    const rendered = readRenderedActions();
    // Matches computeOfferedActions(null) — the recovery set.
    expect(rendered).toEqual([...computeOfferedActions(null)]);
    expect(rendered).toEqual(["repair-the-loss", "take-the-long-way"]);

    // Every rendered node is a real <button type="button"> — the
    // same shape the shipped tap-choice selector picks up.
    for (const button of Array.from(container.children) as HTMLElement[]) {
      expect(button.tagName.toLowerCase()).toBe("button");
      expect(button.getAttribute("type")).toBe("button");
      expect(
        button.getAttribute(AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE),
      ).not.toBeNull();
    }
  });

  it("is idempotent — a second render with the same memory reproduces the same buttons", () => {
    const memory: AftersignRouteRiskMemory = {
      lastRoute: "fast",
      succeeded: true,
    };
    renderRouteRiskChoice({ container, memory, onChoose: () => {} });
    const first = readRenderedActions();
    renderRouteRiskChoice({ container, memory, onChoose: () => {} });
    const second = readRenderedActions();
    expect(second).toEqual(first);
    // No stacking — the writer clears children before re-rendering.
    expect(container.children.length).toBe(first.length);
  });

  it("routes a real .click() on a rendered button through the onChoose handler", () => {
    const chosen: AftersignOfferedAction[] = [];
    renderRouteRiskChoice({
      container,
      memory: { lastRoute: "fast", succeeded: true },
      onChoose: (action) => chosen.push(action),
    });

    // Fast + succeeded → offers "carry-a-fragile-packet" first.
    const button = container.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="carry-a-fragile-packet"]`,
    ) as HTMLElement | null;
    expect(button, "expected a carry-a-fragile-packet button").not.toBeNull();

    button!.click();

    expect(chosen).toEqual(["carry-a-fragile-packet"]);
  });

  it("diverges the offered-action set across runs — tap-driven end-to-end", () => {
    // === Run 1: fast + succeeded ===
    // Simulate a persistence layer with a single memory slot the
    // renderer reads on each pass. Starts at null (no prior run).
    let persistedMemory: AftersignRouteRiskMemory | null = null;

    // Seed: pretend the previous run was fast + succeeded so the
    // renderer offers the "fast-success" set.
    persistedMemory = recordRouteRun({ route: "fast", succeeded: true });

    renderRouteRiskChoice({
      container,
      memory: persistedMemory,
      onChoose: (action) => {
        // The player's tap on an offered action commits a new run
        // outcome. For this test we model:
        //   - "carry-a-fragile-packet" → chose the safe route and
        //     it failed (a fragile packet is where safe runs go
        //     wrong).
        //   - "take-the-long-way"      → chose the safe route and
        //     it succeeded.
        // Either way, this exercises the memory-writes-then-diverges
        // contract that M-LOOP-E1 asks for.
        if (action === "carry-a-fragile-packet") {
          persistedMemory = recordRouteRun({
            route: "safe",
            succeeded: false,
          });
        } else if (action === "take-the-long-way") {
          persistedMemory = recordRouteRun({
            route: "safe",
            succeeded: true,
          });
        }
      },
    });

    const run1Actions = readRenderedActions();
    // Sanity: run 1 offered the fast-success set.
    expect(run1Actions).toEqual([
      "carry-a-fragile-packet",
      "take-the-long-way",
    ]);

    // === Tap ===
    // Player taps "carry-a-fragile-packet" → memory becomes
    // { lastRoute: "safe", succeeded: false }.
    const tapTarget = container.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="carry-a-fragile-packet"]`,
    ) as HTMLElement;
    tapTarget.click();

    expect(persistedMemory).toEqual({
      lastRoute: "safe",
      succeeded: false,
    });

    // === Run 2: re-render with the new memory ===
    renderRouteRiskChoice({
      container,
      memory: persistedMemory,
      onChoose: () => {},
    });

    const run2Actions = readRenderedActions();
    // Failed run → recovery set surfaces.
    expect(run2Actions).toEqual(["repair-the-loss", "take-the-long-way"]);

    // The M-LOOP-E1 acceptance criterion: the offered-action set
    // this run DIFFERS from the offered-action set last run,
    // because the tap wrote a memory fact the next render read.
    expect(run2Actions).not.toEqual(run1Actions);
  });

  it("safe + succeeded run offers a different set from fast + succeeded", () => {
    // Cross-check on the pure primitive so a regression in
    // `computeOfferedActions` that collapsed the two success
    // branches into one reds here as well as in the tap test.
    const fastSuccess = computeOfferedActions(
      recordRouteRun({ route: "fast", succeeded: true }),
    );
    const safeSuccess = computeOfferedActions(
      recordRouteRun({ route: "safe", succeeded: true }),
    );
    expect(fastSuccess).not.toEqual(safeSuccess);
    // And the failure branch is different from both success
    // branches — three genuinely distinct next-run action sets.
    const anyFailure = computeOfferedActions(
      recordRouteRun({ route: "fast", succeeded: false }),
    );
    expect(anyFailure).not.toEqual(fastSuccess);
    expect(anyFailure).not.toEqual(safeSuccess);
  });
});
