import { expect, test } from "@playwright/test";

type PacketConfirmFeel = {
  kind: "packetOpen" | "packetPreserve" | "packetInspect";
  durationMs: number;
  inputLockMs: number;
  cardLiftPx: number;
  cardPunchScale: number;
  glowAlphaPeak: number;
  hapticMs: number;
  audioLeadMs: number;
  easing: string;
  reducedMotionScale: number;
};

type AftersignRuntime = {
  packetChoiceConfirm?: {
    active?: boolean;
    feel?: PacketConfirmFeel;
    startedAtMs?: number;
    lastConfirmedAtMs?: number;
  };
  choosePacketOutcome?: (outcome: "opened" | "sealed" | "inspected") => void;
  confirmPacketChoice?: () => void;
};

const EXPECTED_FEEL: Record<PacketConfirmFeel["kind"], Omit<PacketConfirmFeel, "kind">> = {
  packetOpen: {
    durationMs: 360,
    inputLockMs: 120,
    cardLiftPx: 10,
    cardPunchScale: 1.035,
    glowAlphaPeak: 0.34,
    hapticMs: 18,
    audioLeadMs: 24,
    easing: "cubic-bezier(.2,.8,.2,1)",
    reducedMotionScale: 0.35,
  },
  packetPreserve: {
    durationMs: 420,
    inputLockMs: 140,
    cardLiftPx: 8,
    cardPunchScale: 1.022,
    glowAlphaPeak: 0.26,
    hapticMs: 12,
    audioLeadMs: 18,
    easing: "cubic-bezier(.2,.8,.2,1)",
    reducedMotionScale: 0.35,
  },
  packetInspect: {
    durationMs: 300,
    inputLockMs: 90,
    cardLiftPx: 6,
    cardPunchScale: 1.018,
    glowAlphaPeak: 0.2,
    hapticMs: 8,
    audioLeadMs: 12,
    easing: "cubic-bezier(.2,.8,.2,1)",
    reducedMotionScale: 0.35,
  },
};

test.describe("AFTERSIGN packet-choice confirm feel on the served page", () => {
  test("exposes the packet-open confirm pulse with contract numbers", async ({ page }) => {
    await page.goto("/aftersign/");

    const confirmFeel = await page.evaluate(async () => {
      const game = window.__game as AftersignRuntime | undefined;
      if (!game) return null;

      game.choosePacketOutcome?.("opened");
      game.confirmPacketChoice?.();

      await new Promise((resolve) => requestAnimationFrame(resolve));

      return game.packetChoiceConfirm?.feel ?? null;
    });

    expect(confirmFeel).toEqual({
      kind: "packetOpen",
      ...EXPECTED_FEEL.packetOpen,
    });
  });

  test("keeps every confirm channel inside mobile-safe motion bounds", async ({ page }) => {
    await page.goto("/aftersign/");

    const exposedKinds = await page.evaluate(async () => {
      const game = window.__game as AftersignRuntime | undefined;
      if (!game) return [];

      const outcomes: Array<["opened" | "sealed" | "inspected", PacketConfirmFeel["kind"]]> = [
        ["opened", "packetOpen"],
        ["sealed", "packetPreserve"],
        ["inspected", "packetInspect"],
      ];

      const feels: PacketConfirmFeel[] = [];
      for (const [outcome] of outcomes) {
        game.choosePacketOutcome?.(outcome);
        game.confirmPacketChoice?.();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (game.packetChoiceConfirm?.feel) feels.push(game.packetChoiceConfirm.feel);
      }

      return feels;
    });

    expect(exposedKinds).toHaveLength(3);

    for (const feel of exposedKinds) {
      expect(feel).toEqual({
        kind: feel.kind,
        ...EXPECTED_FEEL[feel.kind],
      });
      expect(feel.durationMs).toBeGreaterThanOrEqual(240);
      expect(feel.durationMs).toBeLessThanOrEqual(480);
      expect(feel.inputLockMs).toBeLessThanOrEqual(140);
      expect(feel.cardLiftPx).toBeLessThanOrEqual(10);
      expect(feel.cardPunchScale).toBeLessThanOrEqual(1.04);
      expect(feel.glowAlphaPeak).toBeLessThanOrEqual(0.34);
      expect(feel.reducedMotionScale).toBeLessThanOrEqual(0.35);
    }
  });
});

declare global {
  interface Window {
    __game?: AftersignRuntime;
  }
}
