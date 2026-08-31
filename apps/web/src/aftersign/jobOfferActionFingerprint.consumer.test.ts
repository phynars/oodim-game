// Consumer wiring for `jobOfferActionFingerprint` (PR #1566 revision).
//
// Soren's REQUEST_CHANGES on the first cut: nothing in the shipped
// surface imported the fingerprint module — grep for
// `fingerprintJobOfferAction` / `ioJobOffersDiverge` matched only the
// two files the PR added. Self-invoking checks on dead code don't
// establish player-facing value; the founder's DoD amendment
// (2026-08-01) rules that shape out explicitly:
//
//   > A contract module with no consumer in the served page is not
//   > shippable value. Wiring an existing contract INTO the page
//   > counts double: it converts stored spec-capital into product.
//
// This spec closes the gap. It boots the served `window.__game`
// surface (via the aftersign vitest lane), primes the two player-
// memory bags that drive divergence (`setPlayerMemory` — the same
// verb the harness surface uses to feed `offeredJobsMemory` into
// `windowGameSurface.ts`), reads `snapshot.story.offeredJobs`, and
// drives the fingerprint primitive against those two arrays —
// proving the tappable action SET diverges element-level between
// memory records (the founder's M-LOOP metric, 2026-08-22
// amendment: "element-level, not text-level").
//
// If a future refactor unwires `selectIoJobOffers` from
// `windowGameSurface.ts`, OR renames a memory branch's id / risk
// tier, OR breaks the `setPlayerMemory → offeredJobs` seam in
// `bootWindowGame.ts`, THIS assertion goes red at the served
// surface — not just in the package unit suite.
//
// Runs in the aftersign vitest blocking lane (see `vitest.config.ts`
// — this file is on the include list next to
// `aftersignJobOfferCopy.consumer.test.ts`).

import { describe, expect, it } from "vitest";

import {
  collectTappableJobOfferKeys,
  fingerprintJobOfferActions,
  ioJobOffersDiverge,
} from "../../../../packages/aftersign/src/jobOfferActionFingerprint";
import {
  SAFE_DEFAULT_JOB_ID,
  type IoJobOffer,
} from "../../../../packages/aftersign/src/computeOfferedJobs";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
} from "./verticalSliceState";
import "./harness/bootWindowGame";

/** Read the served-surface tappable-action set for the current save. */
function readOfferedJobsFromSurface(): IoJobOffer[] {
  const game = window.__game;
  expect(game).toBeDefined();
  const snapshot = game?.getSnapshot();
  const offered = snapshot?.story.offeredJobs;
  expect(Array.isArray(offered)).toBe(true);
  return (offered ?? []) as IoJobOffer[];
}

describe("jobOfferActionFingerprint consumer (window.__game wiring)", () => {
  it("fingerprints the served-surface offered-jobs array without loss", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Fresh boot, no player memory → safe-default offer. The
    // fingerprint round-trip preserves every id the surface published.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.setPlayerMemory(null);

    const offers = readOfferedJobsFromSurface();
    const fingerprints = fingerprintJobOfferActions(offers);
    expect(new Set(fingerprints.map((f) => f.id))).toEqual(
      new Set(offers.map((offer) => offer.id)),
    );
    expect(fingerprints.length).toBeGreaterThan(0);
    // The safe-default id lives at semantic key `#low`.
    expect(collectTappableJobOfferKeys(offers)).toEqual([
      `${SAFE_DEFAULT_JOB_ID}#low`,
    ]);
  });

  it("proves divergence between two memory records at the served surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Seed A: fresh player, no prior interactions — safe-default
    // offer set. This is the SAME code path `windowGameSurface.ts`
    // takes for `offeredJobsMemory: undefined`.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.setPlayerMemory(null);
    const freshOffers = readOfferedJobsFromSurface();
    const freshKeys = collectTappableJobOfferKeys(freshOffers);

    // Seed B: returning player with ≥1 prior interaction.
    // `setPlayerMemory({ playerName, interactionCount: 1 })` is what
    // the harness pipes into `windowGameSurface`'s `offeredJobsMemory`
    // option (see bootWindowGame.ts:755, matching the
    // `windowGameHarnessBoot.test.ts:565-589` reference wiring).
    // `deriveOfferedJobsPlayerMemory` maps interactionCount >= 1 to
    // `priorOutcome: "completed"`, which flips the offer set.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 4),
    );
    game?.setPlayerMemory({
      playerName: "Returning Player",
      interactionCount: 1,
    });
    const returningOffers = readOfferedJobsFromSurface();
    const returningKeys = collectTappableJobOfferKeys(returningOffers);

    // Element-level, not text-level: the semantic-key set differs.
    // If the harness → surface wiring ever collapses so both memory
    // records publish the same tappable action set, THIS goes red —
    // the M-LOOP milestone guard restated in fingerprint terms.
    expect(ioJobOffersDiverge(freshOffers, returningOffers)).toBe(true);
    expect(returningKeys).not.toEqual(freshKeys);

    // Cross-check: at least one id differs — divergence is real, not
    // a risk-tier reshuffle of the same ids.
    const freshIds = new Set(freshOffers.map((o) => o.id));
    const returningIds = new Set(returningOffers.map((o) => o.id));
    const anyReturningIdIsNew = [...returningIds].some(
      (id) => !freshIds.has(id),
    );
    expect(anyReturningIdIsNew).toBe(true);
  });

  it("reports non-divergence when the same memory is loaded twice", () => {
    // The fingerprint must not fabricate divergence — the same
    // memory bag on two loads publishes the same tappable action set.
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.setPlayerMemory({
      playerName: "Returning Player",
      interactionCount: 1,
    });
    const firstLoad = readOfferedJobsFromSurface();
    const firstKeys = collectTappableJobOfferKeys(firstLoad);

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.setPlayerMemory({
      playerName: "Returning Player",
      interactionCount: 1,
    });
    const secondLoad = readOfferedJobsFromSurface();
    const secondKeys = collectTappableJobOfferKeys(secondLoad);

    expect(secondKeys).toEqual(firstKeys);
    expect(ioJobOffersDiverge(firstLoad, secondLoad)).toBe(false);
  });

  it("ignores label copy drift when comparing surface offers", () => {
    // The founder bar rules dialogue-only diffs out of the M-LOOP
    // metric ("dialogue-only differences score zero"). Simulate a
    // copy edit by relabeling a snapshot in-place and re-fingerprint:
    // the predicate reports non-divergence.
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 4),
    );
    game?.setPlayerMemory({
      playerName: "Returning Player",
      interactionCount: 1,
    });
    const original = readOfferedJobsFromSurface();
    const relabeled = original.map((offer) => ({
      ...offer,
      label: `${offer.label} — v2`,
    }));

    expect(ioJobOffersDiverge(original, relabeled)).toBe(false);
    expect(collectTappableJobOfferKeys(original)).toEqual(
      collectTappableJobOfferKeys(relabeled),
    );
  });
});
