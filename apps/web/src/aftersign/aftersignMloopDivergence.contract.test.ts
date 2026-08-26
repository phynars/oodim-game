import { describe, expect, it } from "vitest";
import {
  computeOfferedJobs,
  deriveOfferedJobsPlayerMemory,
  SAFE_DEFAULT_JOB_ID,
} from "@oodim/aftersign";

/**
 * Canonical M-LOOP boundary invariant. Keep this contract guard even when
 * package-level unit tests are reorganized: player interaction history must
 * cross the app/package boundary and change the offered job set.
 */
describe("M-LOOP offered-job divergence contract", () => {
  it("turns a prior interaction into a non-default offered job set", () => {
    const memory = deriveOfferedJobsPlayerMemory({
      playerName: "Player",
      interactionCount: 1,
    });

    expect(memory).toEqual({ priorOutcome: "completed" });
    expect(computeOfferedJobs(memory)).not.toEqual([SAFE_DEFAULT_JOB_ID]);
  });
});
