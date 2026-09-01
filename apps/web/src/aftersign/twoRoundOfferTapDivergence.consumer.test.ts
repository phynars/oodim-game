// Two-round offer TAP-divergence feel — driven through the harness.
//
// PR #1583 originally shipped a parallel `packetOutcome / returnedToIo /
// completedDeliveryIds` taxonomy at `aftersign/src/twoRoundOfferDivergenceFeel.ts`
// with a self-asserting test that no shipped surface imported. Soren's
// REQUEST_CHANGES was correct on both counts: the module was dead code,
// and the "test" couldn't evidence the player-outcome story.
//
// This replacement asserts the actual FEEL contract on the real
// `window.__game` surface — the same seam
// `aftersignJobOfferCopy.consumer.test.ts` taps:
//
//   1. The offer-tile's committing tap target
//      (`snapshot.story.nextJob.offer.copy.tappableActionId`) diverges
//      between a fresh-boot save and a returning save. The player's
//      finger cannot commit the round-2 offer with the round-1
//      action id, or vice versa.
//   2. `game.input.choose(<round-1 id>)` on the FRESH save advances
//      `getAcceptedNextJob()` from null → non-null AND records a
//      take-job feel row through `getAppliedJobTakeFeel()`. The same
//      call after a return save no-ops that path (the returning
//      offer's tappableActionId is different).
//   3. `game.input.choose(<round-2 id>)` on the RETURN save commits
//      the trusted-branch job — same finger, different target, same
//      one-frame tactile confirmation.
//
// The test wires through `input.choose`, not a pure-module call: if a
// future refactor unhooks the copy selector from `bootWindowGame.ts`
// (or drops the `tappableActionId` guard on line 1039–1040), THIS
// assertion goes red.
//
// Runs in the aftersign vitest blocking lane
// (`apps/web/src/aftersign/vitest.config.ts`).

import { describe, expect, it } from "vitest";

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";
import "./harness/bootWindowGame";

const freshRunSave = () =>
  encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1);

const sealedReturnSave = () =>
  encodeAftersignDurableSave(
    meetIoForAftersignSlice(
      recordAftersignPacketChoice(
        createAftersignVerticalSliceState(),
        "sealed",
      ),
    ),
    4,
  );

describe("two-round offer tap-divergence (window.__game)", () => {
  it("advertises a different tappableActionId on the return save than on the fresh save", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(freshRunSave());
    game?.acceptNextJob();
    const firstRoundTapId = (
      game?.getSnapshot().story.nextJob?.offer?.copy as
        | { tappableActionId?: string }
        | undefined
    )?.tappableActionId;

    game?.restoreDurableSave(sealedReturnSave());
    game?.acceptNextJob();
    const secondRoundTapId = (
      game?.getSnapshot().story.nextJob?.offer?.copy as
        | { tappableActionId?: string }
        | undefined
    )?.tappableActionId;

    // Ground-truth pins so a future refactor of aftersignJobOfferCopy.js
    // that collapses the two branches still trips this assertion.
    expect(firstRoundTapId).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId,
    );
    expect(secondRoundTapId).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.tappableActionId,
    );
    expect(firstRoundTapId).not.toBe(secondRoundTapId);
  });

  it("commits the fresh-save offer when the finger taps the round-1 action id", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(freshRunSave());
    expect(game?.getAcceptedNextJob()).toBeNull();
    expect(game?.getAppliedJobTakeFeel()).toBeNull();

    game?.input.choose(AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId);

    expect(game?.getAcceptedNextJob()).not.toBeNull();
    // FEEL wiring: the take-job envelope is stamped on commit.
    const feel = game?.getAppliedJobTakeFeel();
    expect(feel).not.toBeNull();
    expect(feel?.actionId).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId,
    );
  });

  it("commits the return-save offer when the finger taps the round-2 action id", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(sealedReturnSave());
    expect(game?.getAcceptedNextJob()).toBeNull();
    expect(game?.getAppliedJobTakeFeel()).toBeNull();

    game?.input.choose(AFTERSIGN_JOB_OFFER_COPY.trusted.tappableActionId);

    expect(game?.getAcceptedNextJob()).not.toBeNull();
    const feel = game?.getAppliedJobTakeFeel();
    expect(feel).not.toBeNull();
    expect(feel?.actionId).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.tappableActionId,
    );
  });

  it("does not commit or stamp a feel row when the finger taps the OTHER round's action id on the return save", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // On the return save the exposed tap target is `take-job-orra-name-risk`.
    // Tapping the round-1 id (`take-job-blue-seal-safe`) is a wrong-target
    // tap: the harness guard on choiceId === offeredCopy.tappableActionId
    // must NOT admit it. If it did, the player could commit a stale
    // round-1 job after looping — the two-round divergence would leak.
    game?.restoreDurableSave(sealedReturnSave());
    game?.input.choose(AFTERSIGN_JOB_OFFER_COPY.firstRun.tappableActionId);

    expect(game?.getAcceptedNextJob()).toBeNull();
    expect(game?.getAppliedJobTakeFeel()).toBeNull();
  });
});
