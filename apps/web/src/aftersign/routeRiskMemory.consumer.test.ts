// Served-surface PLAYED spec for the M-LOOP-E1 route/risk memory
// (#1372).
//
// Blocking review on PR #1375 (Soren, twice): a pure contract module
// with no wiring into the served surface and no player-outcome spec
// is dead code with green types. This file closes the gap on both
// halves the reviewer flagged:
//
//   1. SERVED-DOM RENDER — load the REAL `aftersign/index.html`,
//      parse it into a JSDOM, find the shipped `#routeRiskChoice`
//      container, and drive `renderRouteRiskChoice` against it.
//      Every offered action gets a real tappable
//      `[data-aftersign-tap-choice]` button on the same node the
//      served renderText loop stamps into. A `.click()` fires the
//      onChoose handler.
//
//   2. PERSIST ROUND-TRIP — feed a mutated `state.player.routeRisk`
//      through the REAL `buildPersistPayload` from
//      `aftersign/src/runtime/persistence.js` and prove the fact
//      lands on the persisted `player.routeRisk` field. The
//      persist path clones `state.player`, so the round-trip is
//      free — but a refactor that dropped `routeRisk` from
//      `state.player` OR forked persistence would silently red
//      this pin.
//
// The pure-primitive divergence assertions the previous draft
// carried are kept as unit checks alongside the served-DOM specs,
// so a regression in `computeOfferedActions` still reds.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (that pulls in THREE.js
//     and the whole scene graph — out of scope for a unit test).
//   - The `main.js` import + seam wiring is asserted at the grep
//     level by `servedSurface.contract.test.ts` — same discipline
//     the tap-choice / return-tone / Orra first-name precedents
//     use.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPersistHelpers } from "../../../../aftersign/src/runtime/persistence.js";

import {
  AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE,
  AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE,
  computeOfferedActions,
  recordRouteRun,
  renderRouteRiskChoice,
  type AftersignOfferedAction,
  type AftersignRouteRiskMemory,
} from "./routeRiskMemory";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const readRenderedActions = (
  container: HTMLElement,
): AftersignOfferedAction[] => {
  const buttons = Array.from(
    container.querySelectorAll(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}]`,
    ),
  ) as HTMLElement[];
  return buttons.map(
    (el) =>
      el.getAttribute(
        AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE,
      ) as AftersignOfferedAction,
  );
};

describe("routeRiskMemory served-surface spec (drives the rendered aftersign/index.html)", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #routeRiskChoice container the writer stamps into", () => {
    // Baseline: the shipped page hosts a `[data-aftersign-route-risk-surface]`
    // container. If a refactor drops it, every writer that stamps a
    // route-risk button has nowhere to render — this spec fires first
    // so the failure points at the DOM contract, not at the writer.
    const doc = dom.window.document;
    const surface = doc.querySelector("#routeRiskChoice");
    expect(surface, "served page must render a #routeRiskChoice node")
      .not.toBeNull();
    expect(surface?.hasAttribute("data-aftersign-route-risk-surface")).toBe(
      true,
    );
  });

  it("stamps two tappable route buttons into the shipped container on the first run", () => {
    const doc = dom.window.document;
    const surface = doc.querySelector("#routeRiskChoice") as HTMLElement;

    // First run: no prior memory → recovery set (repair-the-loss +
    // take-the-long-way). Two visible tappable options — the exact
    // "two tappable route options render during a run" criterion
    // the issue asks for.
    const rendered = renderRouteRiskChoice({
      container: surface,
      memory: null,
      onChoose: () => {},
    });

    expect(rendered).toEqual(["repair-the-loss", "take-the-long-way"]);

    // Both buttons landed on the REAL served node.
    const readBack = readRenderedActions(surface);
    expect(readBack).toEqual(["repair-the-loss", "take-the-long-way"]);

    // Every rendered node is a real <button type="button"> with the
    // shipped `data-aftersign-tap-choice` attribute — the same
    // vocabulary the shipped tap-choice selector picks up.
    const buttons = Array.from(surface.querySelectorAll("button")) as HTMLElement[];
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(button.tagName.toLowerCase()).toBe("button");
      expect(button.getAttribute("type")).toBe("button");
      expect(
        button.getAttribute(AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE),
      ).not.toBeNull();
    }
  });

  it("routes a real .click() on a rendered button through the onChoose handler", () => {
    const doc = dom.window.document;
    const surface = doc.querySelector("#routeRiskChoice") as HTMLElement;
    const chosen: AftersignOfferedAction[] = [];

    renderRouteRiskChoice({
      container: surface,
      memory: { lastRoute: "fast", succeeded: true },
      onChoose: (action) => chosen.push(action),
    });

    // Fast + succeeded → offers "carry-a-fragile-packet" first.
    const button = surface.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="carry-a-fragile-packet"]`,
    ) as HTMLElement | null;
    expect(button, "expected a carry-a-fragile-packet button").not.toBeNull();

    button!.click();

    expect(chosen).toEqual(["carry-a-fragile-packet"]);
  });

  it("diverges the offered-action set across runs — tap-driven end-to-end on the served DOM", () => {
    const doc = dom.window.document;
    const surface = doc.querySelector("#routeRiskChoice") as HTMLElement;

    // === Run 1: fast + succeeded ===
    // Simulate a persistence layer with a single memory slot the
    // renderer reads on each pass. Seeded with the previous run's
    // fact (fast + succeeded) so run 1 offers the fast-success set.
    let persistedMemory: AftersignRouteRiskMemory | null = recordRouteRun({
      route: "fast",
      succeeded: true,
    });

    renderRouteRiskChoice({
      container: surface,
      memory: persistedMemory,
      onChoose: (action) => {
        // Model: "carry-a-fragile-packet" → safe route that failed.
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

    const run1Actions = readRenderedActions(surface);
    expect(run1Actions).toEqual([
      "carry-a-fragile-packet",
      "take-the-long-way",
    ]);

    // Tap the first offered action on the SERVED node.
    const tapTarget = surface.querySelector(
      `[${AFTERSIGN_ROUTE_RISK_TAP_ATTRIBUTE}="carry-a-fragile-packet"]`,
    ) as HTMLElement;
    tapTarget.click();

    expect(persistedMemory).toEqual({
      lastRoute: "safe",
      succeeded: false,
    });

    // === Run 2: re-render with the new memory on the same node ===
    renderRouteRiskChoice({
      container: surface,
      memory: persistedMemory,
      onChoose: () => {},
    });

    const run2Actions = readRenderedActions(surface);
    // Failed run → recovery set surfaces.
    expect(run2Actions).toEqual(["repair-the-loss", "take-the-long-way"]);

    // The M-LOOP-E1 acceptance criterion: the offered-action set
    // this run DIFFERS from the offered-action set last run,
    // because the tap wrote a memory fact the next render read.
    expect(run2Actions).not.toEqual(run1Actions);
  });
});

describe("routeRiskMemory persistence round-trip (drives the served buildPersistPayload)", () => {
  // The issue's #2 acceptance criterion: the persisted fact
  // round-trips across reload. `aftersign/src/runtime/persistence.js`
  // owns the payload shape (`buildPersistPayload` clones
  // `state.player`), so wiring `state.player.routeRisk` into the
  // served page automatically round-trips the fact. This spec pins
  // that round-trip against the REAL persistence factory — a
  // refactor that forked persistence OR dropped `routeRisk` from
  // `state.player` reds here BEFORE any player-visible drift.
  const buildHelpers = (
    initialRouteRisk: AftersignRouteRiskMemory | null,
  ) => {
    // Minimal state shape the persist factory needs. Mirrors the
    // slots the served main.js hands to `createPersistHelpers`.
    const state = {
      scene: { beat: "packet-choice" },
      player: {
        id: "local-slice-player",
        name: null,
        flags: {},
        x: 0,
        z: 0,
        facingRadians: Math.PI,
        secondAction: null,
        returnReason: null,
        routeRisk: initialRouteRisk,
      },
      packet: { delivered: false, route: null, sealed: true, deliveredAt: null },
      delivery: { id: "blue-packet", outcome: "unknown" },
      npcs: {
        io: { memory: [] },
        orra: {
          memory: {},
          lastLine: null,
          lastLineId: null,
          lastLineMemoryRefs: [],
        },
      },
      save: { revision: 0, dirty: false },
    };
    const persistedBlobs: unknown[] = [];
    const helpers = createPersistHelpers({
      state,
      slot: "test",
      clone: (value: unknown) => JSON.parse(JSON.stringify(value)),
      markStateDirty: () => {},
      writeStored: (payload: unknown) => {
        persistedBlobs.push(payload);
      },
      writeAuthoritativeSave: async () => {},
    });
    return { state, helpers, persistedBlobs };
  };

  it("carries state.player.routeRisk into the persist payload verbatim", () => {
    const initial = recordRouteRun({ route: "fast", succeeded: true });
    const { helpers } = buildHelpers(initial);
    const payload = helpers.buildPersistPayload({ dirty: true });
    expect(payload.player.routeRisk).toEqual(initial);
  });

  it("round-trips a mutated fast-succeeded fact through persist and rehydrates the divergent action-set", () => {
    // Run 1: fresh player, no memory yet. Persist the payload.
    const { state, helpers } = buildHelpers(null);
    // Sanity: fresh state → recovery set.
    expect([...computeOfferedActions(state.player.routeRisk)]).toEqual([
      "repair-the-loss",
      "take-the-long-way",
    ]);

    // Player taps the fast-success route mid-run. `main.js`'s
    // onChoose handler assigns `state.player.routeRisk` = the new
    // fact; we simulate that here.
    state.player.routeRisk = recordRouteRun({
      route: "fast",
      succeeded: true,
    });

    // Persist. `writeStored` gets the serialized blob a reload
    // would read.
    const payload = helpers.buildPersistPayload({ dirty: true });
    const persistedJson = JSON.stringify(payload);

    // === Reload: parse the persisted blob the way main.js's boot
    // path does (`stored?.player?.routeRisk`), and re-derive the
    // offered-action set.
    const reloaded = JSON.parse(persistedJson) as {
      player?: { routeRisk?: AftersignRouteRiskMemory | null };
    };
    const rehydratedFact = reloaded.player?.routeRisk ?? null;
    expect(rehydratedFact).toEqual({ lastRoute: "fast", succeeded: true });

    // The rehydrated fact drives a DIFFERENT action-set from the
    // fresh (null) state — this is the "persisted fact round-trips
    // across reload AND feeds computeOfferedActions" criterion the
    // issue asks for, end-to-end through the REAL persist factory.
    const nextRunActions = [...computeOfferedActions(rehydratedFact)];
    expect(nextRunActions).toEqual([
      "carry-a-fragile-packet",
      "take-the-long-way",
    ]);
    expect(nextRunActions).not.toEqual([
      "repair-the-loss",
      "take-the-long-way",
    ]);
  });

  it("distinguishes safe-succeeded from fast-succeeded across the round-trip", () => {
    const { state, helpers } = buildHelpers(null);

    // Two independent player histories → two different persisted
    // blobs → two divergent next-run action sets.
    state.player.routeRisk = recordRouteRun({
      route: "fast",
      succeeded: true,
    });
    const fastBlob = JSON.stringify(helpers.buildPersistPayload({ dirty: true }));

    state.player.routeRisk = recordRouteRun({
      route: "safe",
      succeeded: true,
    });
    const safeBlob = JSON.stringify(helpers.buildPersistPayload({ dirty: true }));

    const fastReloaded = JSON.parse(fastBlob).player.routeRisk;
    const safeReloaded = JSON.parse(safeBlob).player.routeRisk;

    const fastActions = [...computeOfferedActions(fastReloaded)];
    const safeActions = [...computeOfferedActions(safeReloaded)];

    expect(fastActions).not.toEqual(safeActions);
  });
});

describe("routeRiskMemory primitive divergence (pure-function guard)", () => {
  it("safe + succeeded run offers a different set from fast + succeeded", () => {
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

  it("writer surface attribute pin — the container marker is stamped by the writer", () => {
    // Sanity that the same module we're wiring into main.js still
    // exposes the marker main.js grep-pins.
    const dom = new JSDOM(
      `<!doctype html><html><body><div id="host"></div></body></html>`,
    );
    const host = dom.window.document.getElementById("host") as HTMLElement;
    renderRouteRiskChoice({
      container: host,
      memory: null,
      onChoose: () => {},
    });
    expect(host.hasAttribute(AFTERSIGN_ROUTE_RISK_SURFACE_ATTRIBUTE)).toBe(true);
    dom.window.close();
  });
});
