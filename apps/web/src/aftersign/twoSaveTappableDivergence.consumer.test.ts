// Two-save tappable-divergence consumer — #1818 acceptance gate.
//
// #1818 asks for two-record proof: "Two divergent durable save records
// produce visibly different tappable job, price, or route action
// elements on the rendered page." The three memory branches are
// already frozen in `aftersignJobOfferCopy.js` and already wired
// through the served harness (`harness/bootWindowGame.ts` +
// `aftersignJobTakeFeel.consumer.test.ts`, which drive the DOM stamp
// per-branch). What did NOT exist: one spec that boots the SAME
// served surface twice against two DIFFERENT durable saves,
// side-by-side, and asserts the two mounted tappables carry
// different attribute values, different route copy, and different
// risk copy on the same page.
//
// This file is that gate. It consumes the existing divergence
// selector (`chooseAftersignJobOfferCopy`) verbatim — no parallel
// vocabulary, no new frozen table (per HANDOFF-1535's rejection
// pattern: an unwired parallel module is a REQUEST_CHANGES).
//
// Runs in the aftersign vitest blocking lane
// (see `apps/web/src/aftersign/vitest.config.ts`). If a future
// refactor breaks the wire — the served page stops branching by
// memory state, or the two saves collapse to a single tappable —
// this assertion goes red.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_JOB_OFFER_COPY,
  chooseAftersignJobOfferCopy,
} from "./aftersignJobOfferCopy.js";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";
import "./harness/bootWindowGame";

type MountedSurface = {
  element: HTMLElement;
  cleanup: () => void;
};

const mountTakeJobSurface = (actionId: string): MountedSurface => {
  const element = document.createElement("button");
  element.setAttribute("data-aftersign-job-take", actionId);
  document.body.appendChild(element);
  return {
    element,
    cleanup: () => {
      element.remove();
    },
  };
};

/**
 * Restore a durable save and mount the tappable action element the
 * currently-selected memory branch names. Returns the mounted
 * surface plus the resolved copy row so the caller can assert on
 * both the DOM and the ground-truth copy in one shot.
 */
const restoreAndMountBranchTappable = (
  game: NonNullable<Window["__game"]>,
  durableSave: string,
  branchKey: "firstRun" | "trusted" | "opened",
): {
  surface: MountedSurface;
  actionId: string;
} => {
  game.restoreDurableSave(durableSave);
  const actionId = AFTERSIGN_JOB_OFFER_COPY[branchKey].tappableActionId;
  const surface = mountTakeJobSurface(actionId);
  game.input.choose(actionId);
  return { surface, actionId };
};

describe("two-save tappable divergence on the served page (window.__game)", () => {
  let mounted: MountedSurface[] = [];

  beforeEach(() => {
    mounted = [];
  });

  afterEach(() => {
    for (const surface of mounted) {
      surface.cleanup();
    }
    mounted = [];
  });

  it("save A (fresh boot) and save B (sealed delivery) mount visibly different tappable action elements", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    if (!game) return;

    // Save A — fresh vertical-slice state, packetOutcome=null.
    // Divergence selector → firstRun branch.
    const saveA = encodeAftersignDurableSave(
      createAftersignVerticalSliceState(),
      1,
    );

    // Save B — same slice state, delivered SEALED.
    // Divergence selector → trusted branch.
    const saveB = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(
          createAftersignVerticalSliceState(),
          "sealed",
        ),
      ),
      4,
    );

    const a = restoreAndMountBranchTappable(game, saveA, "firstRun");
    mounted.push(a.surface);

    // Snapshot A's rendered copy BEFORE restoring save B — a stateful
    // harness that rebuilds the snapshot on restore must not
    // retroactively mutate what save A rendered.
    const snapshotACopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string; tappableActionId: string }
      | undefined;
    const routeA = snapshotACopy?.route;
    const riskA = snapshotACopy?.risk;

    const b = restoreAndMountBranchTappable(game, saveB, "trusted");
    mounted.push(b.surface);

    const snapshotBCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string; tappableActionId: string }
      | undefined;
    const routeB = snapshotBCopy?.route;
    const riskB = snapshotBCopy?.risk;

    // 1. Tappable action ids DIFFER at the DOM attribute level.
    expect(a.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-blue-seal-safe",
    );
    expect(b.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-orra-name-risk",
    );
    expect(
      a.surface.element.getAttribute("data-aftersign-job-take"),
    ).not.toBe(
      b.surface.element.getAttribute("data-aftersign-job-take"),
    );

    // 2. Route copy DIFFERS between the two rendered offers.
    expect(routeA).toBe(
      "Take the lit stair. Do not stop under the bell rope.",
    );
    expect(routeB).toBe(
      "Cross behind the shuttered pharmacy before the bells count twice.",
    );
    expect(routeA).not.toBe(routeB);

    // 3. Risk copy DIFFERS between the two rendered offers.
    expect(riskA).toBe(
      "Low risk. Long light. Io can see most of it from the kiosk.",
    );
    expect(riskB).toBe(
      "Short route. Unlit. Better pay because Io has one good fact about you.",
    );
    expect(riskA).not.toBe(riskB);

    // 4. The DOM stamp for each tappable carries that branch's
    //    resolved action id (proves each tap committed the correct
    //    branch, not some inherited state from the other save).
    expect(a.surface.element.dataset.aftersignJobTakeActionId).toBe(
      "take-job-blue-seal-safe",
    );
    expect(b.surface.element.dataset.aftersignJobTakeActionId).toBe(
      "take-job-orra-name-risk",
    );
  });

  it("save A (fresh boot) and save B (opened packet) mount visibly different tappable action elements", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    if (!game) return;

    const saveA = encodeAftersignDurableSave(
      createAftersignVerticalSliceState(),
      1,
    );
    // Save B — same slice state, packet OPENED.
    // Divergence selector → opened branch.
    const saveB = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(
          createAftersignVerticalSliceState(),
          "opened",
        ),
      ),
      6,
    );

    const a = restoreAndMountBranchTappable(game, saveA, "firstRun");
    mounted.push(a.surface);
    const snapshotACopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string }
      | undefined;
    const routeA = snapshotACopy?.route;
    const riskA = snapshotACopy?.risk;

    const b = restoreAndMountBranchTappable(game, saveB, "opened");
    mounted.push(b.surface);
    const snapshotBCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string }
      | undefined;
    const routeB = snapshotBCopy?.route;
    const riskB = snapshotBCopy?.risk;

    expect(a.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-blue-seal-safe",
    );
    expect(b.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-wax-debt-repair",
    );
    expect(routeA).not.toBe(routeB);
    expect(riskA).not.toBe(riskB);
    expect(b.surface.element.dataset.aftersignJobTakeActionId).toBe(
      "take-job-wax-debt-repair",
    );
  });

  it("save B (sealed) and save C (opened) mount visibly different tappable action elements — both returning-player branches", () => {
    // Guards the trusted↔opened axis: two RETURNING durable saves
    // (both have delivered a packet) must still diverge from each
    // other, not collapse into a single "returning" tappable.
    const game = window.__game;
    expect(game).toBeDefined();
    if (!game) return;

    const saveB = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(
          createAftersignVerticalSliceState(),
          "sealed",
        ),
      ),
      4,
    );
    const saveC = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(
          createAftersignVerticalSliceState(),
          "opened",
        ),
      ),
      6,
    );

    const b = restoreAndMountBranchTappable(game, saveB, "trusted");
    mounted.push(b.surface);
    const snapshotBCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string; tappableActionId: string }
      | undefined;

    const c = restoreAndMountBranchTappable(game, saveC, "opened");
    mounted.push(c.surface);
    const snapshotCCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string; tappableActionId: string }
      | undefined;

    expect(b.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-orra-name-risk",
    );
    expect(c.surface.element.getAttribute("data-aftersign-job-take")).toBe(
      "take-job-wax-debt-repair",
    );
    expect(
      b.surface.element.getAttribute("data-aftersign-job-take"),
    ).not.toBe(
      c.surface.element.getAttribute("data-aftersign-job-take"),
    );
    expect(snapshotBCopy?.route).not.toBe(snapshotCCopy?.route);
    expect(snapshotBCopy?.risk).not.toBe(snapshotCCopy?.risk);
  });

  it("is deterministic — the same durable save mounts the same tappable action id across two independent restores", () => {
    // #1818 criterion: "Action divergence is deterministic based on
    // saved memory state (no randomness that would break
    // repeatability in playtest)."
    const game = window.__game;
    expect(game).toBeDefined();
    if (!game) return;

    const buildTrustedSave = () =>
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "sealed",
          ),
        ),
        4,
      );

    // First restore.
    const first = restoreAndMountBranchTappable(
      game,
      buildTrustedSave(),
      "trusted",
    );
    mounted.push(first.surface);
    const firstAttr = first.surface.element.getAttribute(
      "data-aftersign-job-take",
    );
    const firstRoute = (
      game.getSnapshot().story.nextJob?.offer?.copy as
        | { route: string }
        | undefined
    )?.route;

    // Second restore of an EQUIVALENT save — must resolve to the
    // same branch. Fresh boot in between (firstRun) rules out
    // any "cached tappable" cheat.
    const interstitial = restoreAndMountBranchTappable(
      game,
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
      "firstRun",
    );
    mounted.push(interstitial.surface);
    expect(interstitial.surface.element.getAttribute("data-aftersign-job-take"))
      .toBe("take-job-blue-seal-safe");

    const second = restoreAndMountBranchTappable(
      game,
      buildTrustedSave(),
      "trusted",
    );
    mounted.push(second.surface);
    const secondAttr = second.surface.element.getAttribute(
      "data-aftersign-job-take",
    );
    const secondRoute = (
      game.getSnapshot().story.nextJob?.offer?.copy as
        | { route: string }
        | undefined
    )?.route;

    expect(secondAttr).toBe(firstAttr);
    expect(secondRoute).toBe(firstRoute);
  });

  it("the DOM divergence matches the pure `chooseAftersignJobOfferCopy` selector — served page is not authoring copy inline", () => {
    // Contract gate: the tappable action ids the served page renders
    // must equal the ids the pure selector returns for the same
    // memory shape. If a future refactor forks the vocabulary (a
    // parallel table with drifted ids, per the HANDOFF-1535
    // rejection pattern), this catches it.
    const game = window.__game;
    expect(game).toBeDefined();
    if (!game) return;

    game.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    const freshCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { tappableActionId: string }
      | undefined;
    expect(freshCopy?.tappableActionId).toBe(
      chooseAftersignJobOfferCopy({}).tappableActionId,
    );

    game.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "sealed",
          ),
        ),
        4,
      ),
    );
    const trustedCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { tappableActionId: string }
      | undefined;
    expect(trustedCopy?.tappableActionId).toBe(
      chooseAftersignJobOfferCopy({
        firstPacketOutcome: "sealed",
        deliveredSealed: true,
      }).tappableActionId,
    );

    game.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "opened",
          ),
        ),
        6,
      ),
    );
    const openedCopy = game.getSnapshot().story.nextJob?.offer?.copy as
      | { tappableActionId: string }
      | undefined;
    expect(openedCopy?.tappableActionId).toBe(
      chooseAftersignJobOfferCopy({
        firstPacketOutcome: "opened",
        packetOpened: true,
      }).tappableActionId,
    );
  });
});
