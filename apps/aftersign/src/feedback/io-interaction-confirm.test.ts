import { describe, expect, it } from "vitest";
import {
  IO_INTERACTION_CONFIRM_AUDIO_FREQUENCY_HZ,
  IO_INTERACTION_CONFIRM_AUDIO_GAIN,
  IO_INTERACTION_CONFIRM_DURATION_MS,
  IO_INTERACTION_CONFIRM_PEAK_SCALE,
  IO_INTERACTION_CONFIRM_RESPONSE_FRAME_BUDGET,
  createIoInteractionConfirmContract,
} from "./io-interaction-confirm";

describe("Io interaction confirm feel contract", () => {
  it("locks the click-to-ack pulse, easing, and audio coupling numbers", () => {
    const contract = createIoInteractionConfirmContract();

    expect(contract.durationMs).toBe(120);
    expect(contract.peakScale).toBe(1.05);
    expect(contract.responseFrameBudget).toBe(2);
    expect(contract.audio).toEqual({
      type: "sine",
      frequencyHz: IO_INTERACTION_CONFIRM_AUDIO_FREQUENCY_HZ,
      gain: IO_INTERACTION_CONFIRM_AUDIO_GAIN,
      durationMs: 45,
    });
  });

  it("renders an acknowledged response inside two 60fps frames", () => {
    const contract = createIoInteractionConfirmContract();
    const twoFramesMs = (1000 / 60) * IO_INTERACTION_CONFIRM_RESPONSE_FRAME_BUDGET;

    expect(contract.sample({ elapsedMs: 0 }).responseVisible).toBe(true);
    expect(contract.sample({ elapsedMs: twoFramesMs }).responseVisible).toBe(true);
    expect(contract.sample({ elapsedMs: twoFramesMs + 0.01 }).responseVisible).toBe(false);
  });

  it("uses a 120ms ease-out-cubic scale pulse that peaks at 1.05", () => {
    const contract = createIoInteractionConfirmContract();
    const midpoint = contract.sample({ elapsedMs: IO_INTERACTION_CONFIRM_DURATION_MS / 2 });

    expect(midpoint.scale).toBeCloseTo(IO_INTERACTION_CONFIRM_PEAK_SCALE, 3);
    expect(contract.sample({ elapsedMs: 0 }).scale).toBeCloseTo(1, 5);
    expect(contract.sample({ elapsedMs: IO_INTERACTION_CONFIRM_DURATION_MS }).scale).toBeCloseTo(1, 5);
  });

  it("plays the 40Hz sine click at 0.3 gain only during the first 45ms", () => {
    const contract = createIoInteractionConfirmContract();

    expect(contract.sample({ elapsedMs: 1 }).audio).toEqual({
      type: "sine",
      frequencyHz: 40,
      gain: 0.3,
      durationMs: 45,
    });
    expect(contract.sample({ elapsedMs: 46 }).audio).toBeNull();
  });
});
