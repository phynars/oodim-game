import { describe, expect, it } from "vitest";
import { AFTERSIGN_CONFIRM_FEEL } from "./aftersignConfirmFeel";
import {
  AFTERSIGN_INTERACTION_CONFIRM_STING,
  sampleAftersignInteractionConfirmSting,
} from "./aftersignInteractionConfirmSting";

describe("AFTERSIGN confirm touchpoint feel", () => {
  it("keeps the committed packet confirm bloom inside a tap-sized recognition envelope", () => {
    expect(AFTERSIGN_CONFIRM_FEEL.durationMs).toBeGreaterThanOrEqual(260);
    expect(AFTERSIGN_CONFIRM_FEEL.durationMs).toBeLessThanOrEqual(420);
    expect(AFTERSIGN_CONFIRM_FEEL.bloomPx).toBeGreaterThanOrEqual(18);
    expect(AFTERSIGN_CONFIRM_FEEL.bloomPx).toBeLessThanOrEqual(36);
    expect(AFTERSIGN_CONFIRM_FEEL.easing).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
  });

  it("keeps the confirmation sting coupled tightly to the visible bloom", () => {
    expect(AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs).toBeGreaterThanOrEqual(120);
    expect(AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs).toBeLessThanOrEqual(
      AFTERSIGN_CONFIRM_FEEL.durationMs,
    );
    expect(AFTERSIGN_INTERACTION_CONFIRM_STING.attackMs).toBeLessThanOrEqual(24);
    expect(AFTERSIGN_INTERACTION_CONFIRM_STING.releaseMs).toBeGreaterThanOrEqual(80);
  });

  it("samples the sting envelope with a crisp attack and fully released tail", () => {
    const attack = sampleAftersignInteractionConfirmSting(16);
    const tail = sampleAftersignInteractionConfirmSting(
      AFTERSIGN_INTERACTION_CONFIRM_STING.durationMs,
    );

    expect(attack.gain).toBeGreaterThan(0.75);
    expect(attack.filterHz).toBeGreaterThanOrEqual(1200);
    expect(tail.gain).toBe(0);
  });
});
