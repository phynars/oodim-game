// Consumer wiring for `aftersignJobTakeFeel.js` (#1549 review).
//
// Soren's REQUEST_CHANGES on the first cut of #1549 mirrored his
// #1404 blocker: the feel envelope compiled + unit-tested clean but
// no shipped surface imported the resolver, and the unit test drove
// no DOM. This spec closes both gates in one lane.
//
// `harness/bootWindowGame.ts` now imports
// `resolveAftersignJobTakeFeel`; every `input.choose("take-job-*")`
// (and the `accept-next-job` alias) resolves the pinned tactile row
// against the tapped branch's route/risk, records it on
// `appliedJobTakeFeel`, and stamps its numbers onto the mounted
// `[data-aftersign-job-take="<actionId>"]` surface. THIS spec taps
// three real DOM elements — firstRun, trusted, opened — and asserts:
//
//   1. `getAppliedJobTakeFeel()` returns a row whose `actionId`
//      matches the tapped branch's `tappableActionId`.
//   2. That row's `durationMs / holdMs / scaleFrom / scalePeak /
//      glowPeakOpacity / audio.cue / easing.press` land on the DOM
//      node's dataset — the RENDER seam a scene painter would read.
//   3. `restoreDurableSave` clears the row to `null` (fresh boot has
//      no in-flight commit to inherit).
//
// If a future refactor unwires the resolver from `bootWindowGame.ts`,
// this file goes red — the CONSUMER gate stays honest.
//
// Runs in the aftersign vitest blocking lane (see `vitest.config.ts`).

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_JOB_TAKE_FEEL,
  resolveAftersignJobTakeFeel,
} from "./aftersignJobTakeFeel.js";
import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
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

describe("aftersignJobTakeFeel consumer (window.__game wiring)", () => {
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

  it("exposes the pinned tactile envelope with sane feel numbers", () => {
    // Ground-truth sanity — the numbers here are what the DOM stamp
    // below writes into dataset entries. Kept as a positive floor so
    // a silent zeroing of the envelope shows up loud.
    expect(AFTERSIGN_JOB_TAKE_FEEL.kind).toBe("aftersign-job-take");
    expect(AFTERSIGN_JOB_TAKE_FEEL.durationMs).toBeGreaterThan(0);
    expect(AFTERSIGN_JOB_TAKE_FEEL.holdMs).toBeGreaterThan(0);
    expect(AFTERSIGN_JOB_TAKE_FEEL.scaleFrom).toBeLessThan(1);
    expect(AFTERSIGN_JOB_TAKE_FEEL.scalePeak).toBeGreaterThan(1);
    expect(AFTERSIGN_JOB_TAKE_FEEL.glowPeakOpacity).toBeGreaterThan(0);
    expect(AFTERSIGN_JOB_TAKE_FEEL.easing.press.length).toBeGreaterThan(0);
    expect(AFTERSIGN_JOB_TAKE_FEEL.audio.cue.length).toBeGreaterThan(0);
  });

  it("stamps the firstRun feel row onto the tapped DOM node on a fresh boot", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    // Fresh boot's row is null — no in-flight commit to inherit.
    expect(game?.getAppliedJobTakeFeel()).toBeNull();

    const actionId = AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId;
    const surface = mountTakeJobSurface(actionId);
    mounted.push(surface);

    game?.input.choose(actionId);

    // Row-only assertion — the seam fired and captured a resolved row.
    const applied = game?.getAppliedJobTakeFeel();
    expect(applied).not.toBeNull();
    expect(applied?.kind).toBe("aftersign-job-take");
    expect(applied?.actionId).toBe(actionId);
    expect(applied?.route).toBe(AFTERSIGN_JOB_OFFER_COPY.firstRun.route);
    expect(applied?.risk).toBe(AFTERSIGN_JOB_OFFER_COPY.firstRun.risk);
    // Matches the pure resolver called directly with the same inputs.
    expect(applied).toEqual(
      resolveAftersignJobTakeFeel({
        actionId,
        route: AFTERSIGN_JOB_OFFER_COPY.firstRun.route,
        risk: AFTERSIGN_JOB_OFFER_COPY.firstRun.risk,
      }),
    );

    // Render seam — the RENDERED element carries the feel numbers.
    const { element } = surface;
    expect(element.dataset.aftersignJobTakeKind).toBe(
      AFTERSIGN_JOB_TAKE_FEEL.kind,
    );
    expect(element.dataset.aftersignJobTakeActionId).toBe(actionId);
    expect(element.dataset.aftersignJobTakeDurationMs).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.durationMs),
    );
    expect(element.dataset.aftersignJobTakeHoldMs).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.holdMs),
    );
    expect(element.dataset.aftersignJobTakeScaleFrom).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.scaleFrom),
    );
    expect(element.dataset.aftersignJobTakeScalePeak).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.scalePeak),
    );
    expect(element.dataset.aftersignJobTakeGlowPeakOpacity).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.glowPeakOpacity),
    );
    expect(element.dataset.aftersignJobTakeAudioCue).toBe(
      AFTERSIGN_JOB_TAKE_FEEL.audio.cue,
    );
    expect(element.dataset.aftersignJobTakeEasingPress).toBe(
      AFTERSIGN_JOB_TAKE_FEEL.easing.press,
    );
    expect(element.getAttribute("aria-label")).toBe(applied?.ariaLabel);
    // Sanity: the accepted next-job is now populated — the take
    // committed, not just decorated.
    expect(game?.getAcceptedNextJob()).not.toBeNull();
  });

  it("stamps the trusted feel row when the player delivered a sealed packet", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
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

    const actionId = AFTERSIGN_JOB_OFFER_COPY.trusted.tappableActionId;
    const surface = mountTakeJobSurface(actionId);
    mounted.push(surface);

    game?.input.choose(actionId);

    const applied = game?.getAppliedJobTakeFeel();
    expect(applied?.actionId).toBe(actionId);
    expect(applied?.route).toBe(AFTERSIGN_JOB_OFFER_COPY.trusted.route);
    expect(applied?.risk).toBe(AFTERSIGN_JOB_OFFER_COPY.trusted.risk);
    expect(surface.element.dataset.aftersignJobTakeActionId).toBe(actionId);
    expect(surface.element.dataset.aftersignJobTakeDurationMs).toBe(
      String(AFTERSIGN_JOB_TAKE_FEEL.durationMs),
    );
  });

  it("stamps the opened feel row when the player opened the packet", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
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

    const actionId = AFTERSIGN_JOB_OFFER_COPY.opened.tappableActionId;
    const surface = mountTakeJobSurface(actionId);
    mounted.push(surface);

    game?.input.choose(actionId);

    const applied = game?.getAppliedJobTakeFeel();
    expect(applied?.actionId).toBe(actionId);
    expect(applied?.route).toBe(AFTERSIGN_JOB_OFFER_COPY.opened.route);
    expect(applied?.risk).toBe(AFTERSIGN_JOB_OFFER_COPY.opened.risk);
    expect(surface.element.dataset.aftersignJobTakeActionId).toBe(actionId);
  });

  it("resolves the same row via the `accept-next-job` alias against the current branch", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );

    // The alias resolves to the currently-offered branch's tappableActionId.
    const branchActionId =
      AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId;
    const surface = mountTakeJobSurface(branchActionId);
    mounted.push(surface);

    game?.input.choose("accept-next-job");

    const applied = game?.getAppliedJobTakeFeel();
    expect(applied?.actionId).toBe(branchActionId);
    expect(surface.element.dataset.aftersignJobTakeActionId).toBe(
      branchActionId,
    );
  });

  it("clears the applied feel row on `restoreDurableSave`", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );

    const actionId = AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId;
    const surface = mountTakeJobSurface(actionId);
    mounted.push(surface);

    game?.input.choose(actionId);
    expect(game?.getAppliedJobTakeFeel()).not.toBeNull();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 2),
    );
    expect(game?.getAppliedJobTakeFeel()).toBeNull();
  });
});
