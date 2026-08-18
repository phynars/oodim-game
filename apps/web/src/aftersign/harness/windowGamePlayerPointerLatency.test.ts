import { describe, expect, it, vi } from "vitest";

import "./bootWindowGame";

describe("Aftersign window.__game player pointer latency", () => {
  it("records a pointer-to-render sample from a real pointerdown event", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(2000).mockReturnValue(2014);

    const button = document.createElement("button");
    button.setAttribute("data-aftersign-tap-choice", "ask-for-next-job");
    document.body.appendChild(button);

    try {
      game?.input.resetPointerToRenderLatency();

      const pointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(pointerDown, "pointerId", { value: 7 });
      button.dispatchEvent(pointerDown);

      game?.input.markPointerRendered({ pointerId: 7, renderedAtMs: performance.now() });

      const report = game?.input.getPointerToRenderLatencyReport();
      expect(report?.samples).toEqual([
        {
          pointerAtMs: 2000,
          renderedAtMs: 2014,
          deltaMs: 14,
          frameBudgetMs: 16.7,
          withinBudget: true,
        },
      ]);
      expect(report?.latest).toEqual(report?.samples[0]);
      expect(report?.worst).toEqual(report?.samples[0]);
    } finally {
      button.remove();
      game?.input.resetPointerToRenderLatency();
      nowSpy.mockRestore();
    }
  });
});
