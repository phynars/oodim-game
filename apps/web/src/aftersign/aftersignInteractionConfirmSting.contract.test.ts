import { describe, expect, it } from "vitest";
import {
  AFTERSIGN_INTERACTION_CONFIRM_STING,
  sampleAftersignInteractionConfirmSting,
} from "./aftersignInteractionConfirmSting";

function flattenFeelTokens(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenFeelTokens(entry));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => [key, ...flattenFeelTokens(entry)]);
  }
  return [];
}

describe("AFTERSIGN interaction-confirm sting contract", () => {
  it("pins the player-input accept pulse to a 120ms ease-out-cubic bloom pop and 90ms descending chirp", () => {
    const tokens = flattenFeelTokens(AFTERSIGN_INTERACTION_CONFIRM_STING).join(" ").toLowerCase();

    // 120 ms total sting.
    expect(tokens).toContain("120");
    // Ease-out-cubic applied to bloom scale + chirp gain.
    expect(tokens).toContain("ease-out-cubic");
    // Bloom pop peak scale.
    expect(tokens).toContain("1.08");
    // Post-pop settle offset in px.
    expect(tokens).toContain("4");
    // Descending chirp: 90 ms duration, 880 Hz → 660 Hz.
    expect(tokens).toContain("90");
    expect(tokens).toContain("880");
    expect(tokens).toContain("660");
  });

  it("samples the bloom pop peak at 35% of duration and returns the spec's peak scale", () => {
    const peakSample = sampleAftersignInteractionConfirmSting(
      AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs * 0.35,
    );
    expect(peakSample.bloomScale).toBeCloseTo(AFTERSIGN_INTERACTION_CONFIRM_STING.bloomPopScale, 5);
  });

  it("descends chirp from 880 Hz at t=0 to 660 Hz by t=chirpDurationMs, then silences gain", () => {
    const start = sampleAftersignInteractionConfirmSting(0);
    const end = sampleAftersignInteractionConfirmSting(
      AFTERSIGN_INTERACTION_CONFIRM_STING.chirpDurationMs,
    );
    expect(start.chirpHz).toBe(880);
    expect(end.chirpHz).toBe(660);
    // Chirp is silent at/after chirpDurationMs — the bloom carries the tail alone.
    expect(end.chirpGain).toBe(0);
    // But at t=0 the chirp is at full gain.
    expect(start.chirpGain).toBe(1);
  });

  it("clamps negative elapsed to 0 and stays within the sample envelope past durationMs", () => {
    const before = sampleAftersignInteractionConfirmSting(-50);
    const after = sampleAftersignInteractionConfirmSting(
      AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs + 500,
    );
    expect(before.elapsedMs).toBe(0);
    expect(before.progress).toBe(0);
    expect(after.progress).toBe(1);
    expect(after.bloomOpacity).toBe(0);
  });
});
