import { describe, expect, it } from "vitest";

import "./bootWindowGame";

type PointerToRenderLatencySample = {
  pointerAtMs: number;
  renderedAtMs: number;
  deltaMs: number;
  frameBudgetMs: number;
  withinBudget: boolean;
};

type PointerToRenderLatencyProbe = {
  resetPointerToRenderLatency?: () => void;
  markPointerIntent?: (input: { pointerAtMs: number; pointerId: number }) => void;
  markPointerRendered?: (input: { renderedAtMs: number; pointerId: number }) => void;
  getPointerToRenderLatencyReport?: () => {
    latest?: PointerToRenderLatencySample;
    worst?: PointerToRenderLatencySample;
    samples: PointerToRenderLatencySample[];
  };
};

describe("Aftersign pointer-to-render latency harness contract", () => {
  it("caps accepted pointer input to visible render feedback inside one 60fps frame", () => {
    const game = window.__game as
      | (typeof window.__game & { input?: PointerToRenderLatencyProbe })
      | undefined;

    expect(game).toBeDefined();
    expect(game?.input?.resetPointerToRenderLatency).toEqual(expect.any(Function));
    expect(game?.input?.markPointerIntent).toEqual(expect.any(Function));
    expect(game?.input?.markPointerRendered).toEqual(expect.any(Function));
    expect(game?.input?.getPointerToRenderLatencyReport).toEqual(expect.any(Function));

    game?.input?.resetPointerToRenderLatency?.();
    game?.input?.markPointerIntent?.({ pointerAtMs: 1_000, pointerId: 7 });
    game?.input?.markPointerRendered?.({ renderedAtMs: 1_016, pointerId: 7 });

    const report = game?.input?.getPointerToRenderLatencyReport?.();

    expect(report?.samples).toHaveLength(1);
    expect(report?.latest).toMatchObject({
      pointerAtMs: 1_000,
      renderedAtMs: 1_016,
      deltaMs: 16,
      frameBudgetMs: 16.7,
      withinBudget: true,
    });
    expect(report?.worst?.deltaMs).toBeLessThanOrEqual(16.7);
    expect(report?.worst?.withinBudget).toBe(true);
  });
});
