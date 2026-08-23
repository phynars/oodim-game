import { describe, expect, it } from "vitest";
import {
  COMPLETED_JOB_IDS,
  computeOfferedJobs,
  deriveOfferedJobsPlayerMemory,
  SAFE_DEFAULT_JOB_ID,
  TRUSTED_COURIER_JOB_IDS,
  type PlayerMemory,
} from "./computeOfferedJobs";

describe("computeOfferedJobs", () => {
  it("returns one safe default job for absent or empty memory", () => {
    expect(computeOfferedJobs()).toEqual([SAFE_DEFAULT_JOB_ID]);
    expect(computeOfferedJobs({})).toEqual([SAFE_DEFAULT_JOB_ID]);
  });

  it("offers a distinct job set to a trusted courier", () => {
    const emptyOffers = computeOfferedJobs({});
    const trustedOffers = computeOfferedJobs({
      trustPosture: "trusted-courier",
    });

    expect(trustedOffers).toEqual([...TRUSTED_COURIER_JOB_IDS]);
    expect(trustedOffers).not.toEqual(emptyOffers);
  });

  it("diverges element-wise for trust posture and prior outcome without mutation", () => {
    const guarded: PlayerMemory = { trustPosture: "guarded" };
    const failed: PlayerMemory = { priorOutcome: "failed" };

    expect(computeOfferedJobs(guarded)).toEqual(["job-low-risk-errand"]);
    expect(computeOfferedJobs(failed)).toEqual(["job-redemption-route"]);
    expect(computeOfferedJobs(guarded)).not.toEqual(computeOfferedJobs(failed));
    expect(guarded).toEqual({ trustPosture: "guarded" });
    expect(failed).toEqual({ priorOutcome: "failed" });
  });

  it("returns fresh deterministic arrays", () => {
    const first = computeOfferedJobs({ trustPosture: "trusted-courier" });
    const second = computeOfferedJobs({ trustPosture: "trusted-courier" });

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  describe("deriveOfferedJobsPlayerMemory", () => {
    it("returns undefined for null/undefined input", () => {
      expect(deriveOfferedJobsPlayerMemory(null)).toBeUndefined();
      expect(deriveOfferedJobsPlayerMemory(undefined)).toBeUndefined();
    });

    it("maps interactionCount >= 1 to priorOutcome: completed and drives divergence", () => {
      const memory = deriveOfferedJobsPlayerMemory({
        playerName: "Player",
        interactionCount: 1,
      });

      expect(memory).toEqual({ priorOutcome: "completed" });
      expect(computeOfferedJobs(memory)).toEqual([...COMPLETED_JOB_IDS]);
      expect(computeOfferedJobs(memory)).not.toEqual([SAFE_DEFAULT_JOB_ID]);
    });

    it("leaves priorOutcome unset for zero prior interactions", () => {
      const memory = deriveOfferedJobsPlayerMemory({
        playerName: "Player",
        interactionCount: 0,
      });

      expect(memory).toEqual({});
      expect(computeOfferedJobs(memory)).toEqual([SAFE_DEFAULT_JOB_ID]);
    });

    it("ignores non-finite interactionCount values", () => {
      const memory = deriveOfferedJobsPlayerMemory({
        playerName: "Player",
        interactionCount: Number.NaN,
      });

      expect(memory).toEqual({});
    });
  });
});
