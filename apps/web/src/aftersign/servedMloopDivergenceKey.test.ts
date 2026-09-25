// Pins the three return values of `servedMloopDivergenceKey` — the
// helper `aftersign/main.js` uses to stamp `data-mloop-divergence-memory`
// on the rendered `#offeredJobs` tray at `packet-offered`.
//
// PR #1934 re-review (Soren Vask): the presentation attribute needs a
// consumer AND the branch labels need a pin. The played spec at
// `aftersign/e2e/mloop-served-divergence-played.spec.ts` reads the
// attribute at the tap surface; this file locks the label vocabulary
// so a future relabel of "fresh" | "completed" | "debt-held" reds here
// alongside the spec (both surfaces move together, per the same
// discipline `computeOfferedJobs.test.ts` uses for its route-risk
// tokens).
//
// The helper is deliberately narrow — no dependency on the full
// `PlayerMemory` bag, just the durable-memory *posture* the served
// tray needs to identify. If it ever grows a fourth branch, add the
// case here first.

import { describe, expect, it } from "vitest";

// eslint-disable-next-line import/no-relative-parent-imports
import { servedMloopDivergenceKey } from "../../../../aftersign/mloop-served-divergence.js";

describe("servedMloopDivergenceKey — durable-memory branch label for the served offer tray", () => {
  it("returns `fresh` when memory is missing (null, undefined, or empty object)", () => {
    expect(servedMloopDivergenceKey(undefined)).toBe("fresh");
    expect(servedMloopDivergenceKey(null)).toBe("fresh");
    expect(servedMloopDivergenceKey({})).toBe("fresh");
  });

  it("returns `completed` when priorOutcome === \"completed\" — the sealed-delivery posture", () => {
    expect(servedMloopDivergenceKey({ priorOutcome: "completed" })).toBe(
      "completed",
    );
    // Sealed override outranks a coincident debtHeld count — mirrors
    // `offeredJobsMemoryFromIoMemory`'s "sealed wins" order.
    expect(
      servedMloopDivergenceKey({ priorOutcome: "completed", debtHeld: 3 }),
    ).toBe("completed");
  });

  it("returns `debt-held` when debtHeld is a finite positive number and no completed outcome is set", () => {
    expect(servedMloopDivergenceKey({ debtHeld: 1 })).toBe("debt-held");
    expect(servedMloopDivergenceKey({ debtHeld: 4 })).toBe("debt-held");
  });

  it("returns `fresh` when debtHeld is zero, negative, non-finite, or non-numeric", () => {
    // Only strictly-positive, finite counts flip the branch — anything
    // else falls through to `fresh` (the safe default the primitive
    // uses for a truly empty player-memory bag).
    expect(servedMloopDivergenceKey({ debtHeld: 0 })).toBe("fresh");
    expect(servedMloopDivergenceKey({ debtHeld: -1 })).toBe("fresh");
    expect(servedMloopDivergenceKey({ debtHeld: Number.NaN })).toBe("fresh");
    expect(servedMloopDivergenceKey({ debtHeld: Infinity })).toBe("fresh");
    // Non-numeric — the runtime derivation can't produce this shape,
    // but the guard belongs here so a shape drift can't flip the
    // branch accidentally.
    expect(servedMloopDivergenceKey({ debtHeld: "3" })).toBe("fresh");
  });

  it("returns `fresh` when priorOutcome is any label OTHER than completed", () => {
    // Only the exact string "completed" flips the branch — future
    // memory schemas may add other priorOutcome values, and those
    // must not silently claim the completed label at the tray.
    expect(servedMloopDivergenceKey({ priorOutcome: "failed" })).toBe("fresh");
    expect(servedMloopDivergenceKey({ priorOutcome: "guarded" })).toBe("fresh");
    expect(servedMloopDivergenceKey({ priorOutcome: "" })).toBe("fresh");
  });

  it("returns exactly one of the three documented labels — no other value is a legal stamp on data-mloop-divergence-memory", () => {
    const LEGAL = new Set(["fresh", "completed", "debt-held"]);
    const samples: Array<unknown> = [
      undefined,
      null,
      {},
      { priorOutcome: "completed" },
      { debtHeld: 2 },
      { priorOutcome: "failed" },
      { debtHeld: 0 },
      { priorOutcome: "completed", debtHeld: 5 },
      { trustPosture: "trusted-courier" },
    ];
    for (const sample of samples) {
      expect(
        LEGAL.has(servedMloopDivergenceKey(sample as never)),
        `servedMloopDivergenceKey(${JSON.stringify(sample)}) must return one of fresh|completed|debt-held`,
      ).toBe(true);
    }
  });
});
