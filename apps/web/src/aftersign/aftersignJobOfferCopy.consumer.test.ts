// Consumer wiring for `aftersignJobOfferCopy.js` (#1404 review).
//
// Soren's REQUEST_CHANGES on PR #1404 was: the copy module compiled but
// had zero shipped-surface importers — `chooseAftersignJobOfferCopy`
// only referenced itself inside the .js file. Green tests couldn't
// approve a module the game never reads.
//
// This spec closes that gap. `harness/bootWindowGame.ts` now imports
// the branch selector and folds the chosen row into the served-page
// snapshot at `story.nextJob.offer.copy` when the player has accepted
// Io's next-job handoff. The three memory branches the JS module
// declares (`firstRun` / `trusted` / `opened`) each map to a distinct
// vertical-slice `packetOutcome` — this test drives all three through
// the harness surface and asserts the strings arrive verbatim.
//
// Runs in the aftersign vitest blocking lane (see `vitest.config.ts`).
// If a future refactor unwires the copy selector from
// `bootWindowGame.ts`, THIS assertion goes red.

import { describe, expect, it } from "vitest";

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

describe("aftersignJobOfferCopy consumer (window.__game wiring)", () => {
  // Pure-selector sanity: the three declared branches are non-empty
  // frozen rows. This is the ground truth the harness projection is
  // expected to match; if the copy module is refactored, both sides
  // move together.
  it("exposes three distinct memory branches with populated copy rows", () => {
    for (const branch of [
      AFTERSIGN_JOB_OFFER_COPY.firstRun,
      AFTERSIGN_JOB_OFFER_COPY.trusted,
      AFTERSIGN_JOB_OFFER_COPY.opened,
    ]) {
      expect(branch.id).toEqual(expect.any(String));
      expect(branch.tappableActionId).toEqual(expect.any(String));
      expect(branch.route.length).toBeGreaterThan(0);
      expect(branch.risk.length).toBeGreaterThan(0);
      expect(branch.title.length).toBeGreaterThan(0);
      expect(branch.ioLine.length).toBeGreaterThan(0);
      expect(branch.actionLabel.length).toBeGreaterThan(0);
      expect(branch.summary.length).toBeGreaterThan(0);
      expect(branch.safeRouteLabel.length).toBeGreaterThan(0);
      expect(branch.riskyRouteLabel.length).toBeGreaterThan(0);
    }
    // The three ids are distinct — no branch collision.
    const ids = new Set([
      AFTERSIGN_JOB_OFFER_COPY.firstRun.id,
      AFTERSIGN_JOB_OFFER_COPY.trusted.id,
      AFTERSIGN_JOB_OFFER_COPY.opened.id,
    ]);
    expect(ids.size).toBe(3);
  });

  it("projects the first-run copy through the harness snapshot on a fresh boot", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Fresh vertical-slice state → packetOutcome null → firstRun copy.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { copy?: unknown }
      | undefined;
    expect(offer?.copy).toEqual(AFTERSIGN_JOB_OFFER_COPY.firstRun);
    expect((offer?.copy as { tappableActionId?: string } | undefined)?.tappableActionId).toBe(
      "take-job-blue-seal-safe",
    );
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.input.choose("take-job-blue-seal-safe");
    expect(game?.getAcceptedNextJob()).not.toBeNull();
    expect(game?.getAppliedTapConfirmFeel()).not.toBeNull();
    // Cross-check: the selector called directly with the same shape
    // returns the same row — proves the harness is calling THIS
    // primitive, not authoring copy inline.
    expect(offer?.copy).toEqual(chooseAftersignJobOfferCopy({}));
  });

  it("projects the trusted copy when the player delivered a sealed packet", () => {
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
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { copy?: unknown }
      | undefined;
    expect(offer?.copy).toEqual(AFTERSIGN_JOB_OFFER_COPY.trusted);
    expect((offer?.copy as { tappableActionId?: string } | undefined)?.tappableActionId).toBe(
      "take-job-orra-name-risk",
    );
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
    game?.input.choose("take-job-orra-name-risk");
    expect(game?.getAcceptedNextJob()).not.toBeNull();
    expect(game?.getAppliedTapConfirmFeel()).not.toBeNull();
    expect(offer?.copy).toEqual(
      chooseAftersignJobOfferCopy({
        firstPacketOutcome: "sealed",
        deliveredSealed: true,
      }),
    );
  });

  it("projects the opened copy when the player opened the packet", () => {
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
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { copy?: unknown }
      | undefined;
    expect(offer?.copy).toEqual(AFTERSIGN_JOB_OFFER_COPY.opened);
    expect((offer?.copy as { tappableActionId?: string } | undefined)?.tappableActionId).toBe(
      "take-job-wax-debt-repair",
    );
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
    game?.input.choose("take-job-wax-debt-repair");
    expect(game?.getAcceptedNextJob()).not.toBeNull();
    expect(game?.getAppliedTapConfirmFeel()).not.toBeNull();
    expect(offer?.copy).toEqual(
      chooseAftersignJobOfferCopy({
        firstPacketOutcome: "opened",
        packetOpened: true,
      }),
    );
  });

  it("keeps the visible offer copy divergent between first and looped runs", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Snapshot copy fields into locals immediately (deep-clone via
    // JSON round-trip) so a stateful harness that later rebuilds the
    // snapshot on `restoreDurableSave` can't retroactively mutate the
    // first-run reference we're comparing against.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.acceptNextJob();
    const firstRunCopyLive = game?.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string }
      | undefined;
    const firstRunRoute = firstRunCopyLive?.route;
    const firstRunRisk = firstRunCopyLive?.risk;

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
    game?.acceptNextJob();
    const trustedCopyLive = game?.getSnapshot().story.nextJob?.offer?.copy as
      | { route: string; risk: string }
      | undefined;
    const trustedRoute = trustedCopyLive?.route;
    const trustedRisk = trustedCopyLive?.risk;

    expect(firstRunRoute).toBe(
      "Take the lit stair. Do not stop under the bell rope.",
    );
    expect(firstRunRisk).toBe(
      "Low risk. Long route. Io can see most of it from the kiosk.",
    );
    expect(trustedRoute).toBe(
      "Cross behind the shuttered pharmacy before the bells count twice.",
    );
    expect(trustedRisk).toBe(
      "Short route. Unlit. Better pay because Io trusts your hands.",
    );
    expect(trustedRoute).not.toBe(firstRunRoute);
    expect(trustedRisk).not.toBe(firstRunRisk);
  });

  // JSON serialisability guard — the copy must survive a
  // `postMessage`/localStorage round-trip a scene renderer might
  // stage. Object.freeze doesn't affect JSON.stringify, but the
  // shape check keeps future refactors honest if someone adds a
  // symbol-keyed field.
  it("keeps the copy field JSON-serialisable end-to-end", () => {
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
        2,
      ),
    );
    game?.acceptNextJob();

    const snapshot = game?.getSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
