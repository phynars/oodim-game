import { describe, expect, it } from "vitest";
import {
  createAftersignVerticalSliceState,
  recordAftersignAskedForNextJob,
  recordAftersignNextJobRequest,
  recordAftersignReturnToneChoice,
} from "./verticalSliceRuntimeState";

describe("Aftersign return-tone runtime state", () => {
  it("stamps the exact remembered tone when the returning player answers Io", () => {
    const state = recordAftersignReturnToneChoice(
      createAftersignVerticalSliceState(),
      "blunt",
    );

    expect(state.hasChosenReturnTone).toBe(true);
    expect(state.rememberedTone).toBe("blunt");
  });

  it("defaults legacy tone-less callers to evasive without erasing the choice axis", () => {
    const state = recordAftersignReturnToneChoice(
      createAftersignVerticalSliceState(),
    );

    expect(state.hasChosenReturnTone).toBe(true);
    expect(state.rememberedTone).toBe("evasive");
  });

  it("preserves the remembered tone when the player asks Io for the next job", () => {
    const answered = recordAftersignReturnToneChoice(
      createAftersignVerticalSliceState(),
      "kind",
    );
    const nextJob = recordAftersignAskedForNextJob(answered);

    expect(nextJob.hasChosenReturnTone).toBe(true);
    expect(nextJob.hasAskedForNextJob).toBe(true);
    expect(nextJob.rememberedTone).toBe("kind");
  });

  it("rejects next-job requests before the return tone has been chosen", () => {
    expect(() =>
      recordAftersignNextJobRequest(createAftersignVerticalSliceState()),
    ).toThrow(/return tone has not been chosen/);
  });
});
