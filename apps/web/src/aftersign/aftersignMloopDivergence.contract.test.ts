import { describe, expect, it } from "vitest";
import {
  COMPLETED_JOB_IDS,
  computeOfferedJobs,
  deriveOfferedJobsPlayerMemory,
  SAFE_DEFAULT_JOB_ID,
} from "../../../../packages/aftersign/src/computeOfferedJobs";

/**
 * Canonical M-LOOP boundary invariant.
 *
 * Keep this contract guard even when package-level unit tests are
 * reorganized. It intentionally repeats a small part of the primitive's
 * behavior because its job is different: prove the harness-shaped memory
 * bag that an app/window surface carries can cross the app→package seam via
 * `deriveOfferedJobsPlayerMemory` and change the offered job set a served
 * surface publishes.
 *
 * If this looks redundant with `packages/aftersign/src/computeOfferedJobs.test.ts`,
 * preserve this file as the boundary smoke test and move detailed branch
 * coverage there. This file should stay narrow: one fresh-session assertion,
 * one returning-player assertion, no new job-selection rules.
 *
 * Import path note: the repo does not yet expose an `@oodim/aftersign`
 * barrel — see `apps/web/src/aftersign/windowGameSurface.ts`, which uses
 * the same deep relative path. If/when a package barrel lands, swap all
 * three call sites together.
 */
describe("M-LOOP offered-job app/package boundary contract", () => {
  it("turns harness-shaped prior interaction memory into a non-default offered job set", () => {
    // Harness-shape input (what the window surface actually carries) must
    // cross the app→package boundary and yield the memory record that
    // `computeOfferedJobs` reads.
    const memory = deriveOfferedJobsPlayerMemory({
      playerName: "Player",
      interactionCount: 1,
    });

    expect(memory).toEqual({ priorOutcome: "completed" });
    expect(computeOfferedJobs(memory)).not.toEqual([SAFE_DEFAULT_JOB_ID]);
    expect(computeOfferedJobs(memory)).toEqual([...COMPLETED_JOB_IDS]);
  });

  it("keeps absent harness memory on the safe-default offered job", () => {
    // Absent harness memory must not fabricate divergence — the primitive
    // falls through to `[SAFE_DEFAULT_JOB_ID]` and the derivation returns
    // `undefined` for a missing bag.
    expect(deriveOfferedJobsPlayerMemory(undefined)).toBeUndefined();
    expect(computeOfferedJobs(undefined)).toEqual([SAFE_DEFAULT_JOB_ID]);
  });
});
