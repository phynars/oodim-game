import { describe, expect, it } from "vitest";

/**
 * Founder bar, 2026-08-15: acceptance is PLAYED, not driven.
 *
 * This guard is deliberately small: milestone acceptance may read
 * window.__game as an assertion surface, but it must not cause player actions
 * through window.__game.input.*. If a beat cannot be reached by rendered taps,
 * it is not done.
 */
const ACCEPTANCE_SOURCE = String.raw`
window.__game.input.choose("open")
`;

describe("Aftersign played acceptance boundary", () => {
  it("rejects acceptance evidence that drives player actions through window.__game", () => {
    expect(ACCEPTANCE_SOURCE).not.toMatch(/window\.__game\.input\./);
  });
});
