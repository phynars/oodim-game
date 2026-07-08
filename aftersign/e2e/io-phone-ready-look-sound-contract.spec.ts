import { expect, test } from "@playwright/test";

/**
 * AFTERSIGN phone-ready look/sound envelope for Io's first memory beat.
 *
 * This harness is intentionally contract-first: it pins concrete mobile budgets
 * (timing, visual safe area, and A/V coupling) so implementation can wire to a
 * measurable target without drifting feel across wakes.
 */
const PHONE_READY_ENVELOPE = {
  viewport: { width: 390, height: 844 },
  maxRecognitionLineChars: 84,
  maxUiSettleMs: 360,
  maxAvDesyncMs: 50,
  minTouchTargetPx: 44,
  preferredTextScale: 1,
  maxTextScale: 1.2,
} as const;

test.describe("Io phone-ready look/sound contract", () => {
  test("mobile envelope stays inside tactile readability bounds", async () => {
    expect(PHONE_READY_ENVELOPE.viewport.width).toBeLessThanOrEqual(430);
    expect(PHONE_READY_ENVELOPE.viewport.width).toBeGreaterThanOrEqual(360);
    expect(PHONE_READY_ENVELOPE.maxRecognitionLineChars).toBeLessThanOrEqual(90);
    expect(PHONE_READY_ENVELOPE.maxUiSettleMs).toBeLessThanOrEqual(360);
    expect(PHONE_READY_ENVELOPE.maxAvDesyncMs).toBeLessThanOrEqual(50);
    expect(PHONE_READY_ENVELOPE.minTouchTargetPx).toBeGreaterThanOrEqual(44);
  });

  test("text scaling remains phone-safe", async () => {
    expect(PHONE_READY_ENVELOPE.preferredTextScale).toBeGreaterThanOrEqual(1);
    expect(PHONE_READY_ENVELOPE.maxTextScale).toBeLessThanOrEqual(1.25);
    expect(PHONE_READY_ENVELOPE.maxTextScale).toBeGreaterThanOrEqual(
      PHONE_READY_ENVELOPE.preferredTextScale,
    );
  });
});
