import { describe, expect, it } from "vitest";
import {
  COMPLETED_JOB_IDS,
  computeOfferedJobs,
  SAFE_DEFAULT_JOB_ID,
} from "../../../../packages/aftersign/src/computeOfferedJobs";

describe("M-LOOP divergence contract", () => {
  it("requires different memory records to produce different tappable action IDs", () => {
    const firstRunJobIds = computeOfferedJobs(undefined);
    const completedRunJobIds = computeOfferedJobs({ priorOutcome: "completed" });

    expect(firstRunJobIds).toEqual([SAFE_DEFAULT_JOB_ID]);
    expect(completedRunJobIds).toEqual([...COMPLETED_JOB_IDS]);
    expect(completedRunJobIds).not.toEqual(firstRunJobIds);
  });
});
