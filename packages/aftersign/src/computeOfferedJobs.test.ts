import { describe, expect, it } from "vitest";
import {
  computeOfferedJobs,
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
});
