// AFTERSIGN — pin the served-page mloop memory-gate derivation.
//
// PR #1642 follow-up. This file's job is to pin the derivation path
// the SERVED PAGE actually runs — not a related-but-different one.
//
// The served page (`aftersign/main.js` ~line 1947) builds its mloop
// memory bag inline like this:
//
//   const packetOutcomeFactObject = state.npcs.io.memory.find(
//     (fact) => fact?.kind === "delivery-outcome",
//   )?.object;
//   const mloopMemory = packetOutcomeFactObject
//     ? { packetOutcome: packetOutcomeFactObject }
//     : {};
//   ...
//   const mloopAction = getMloopAvailableAction(offer.id, mloopMemory);
//
// The bag shape the gate consumes is therefore
//   { packetOutcome: "sealed" } → returning
//   { packetOutcome: "opened" } → deep-recall
//   {}                          → fresh
// — the LEGACY consumer-test shape, not the
// `offeredJobsMemoryFromIoMemory` output (`{ priorOutcome } | { debtHeld }`)
// which feeds `selectIoJobOffers` on a separate axis.
//
// Soren's non-blocking concern on the prior draft of this file was
// exactly that: the earlier test drove the FEED-INTO-selectIoJobOffers
// shape through `getMloopAvailableAction`, which is not what the
// served page ever does. Rewriting the test around the actual
// `packetOutcomeFactObject` → `mloopMemory` transform locks the
// real served-page derivation.
//
// Kept apart from `aftersignMloopDivergence.contract.test.ts` (which
// pins the SELECTION axis via `selectIoJobOffers`) because this file
// pins the ACTION-GATE axis via `getMloopAvailableAction`. They are
// two different consumers of the same underlying memory posture and
// both need to diverge for the e2e
// `aftersign/e2e/m-loop-divergent-offered-actions.playtest.spec.ts`
// to go green.

import { describe, expect, it } from "vitest";
// The served page (`aftersign/main.js`) imports this module straight
// from `aftersign/`. This test does the same so a reshape of the
// import contract lights up here.
// eslint-disable-next-line import/no-relative-parent-imports
import { getMloopAvailableAction } from "../../../../aftersign/mloop-copy.js";

// A representative jobId from the mloop-copy action table so the row
// exists and the returned `memoryGate` is the axis under test (not a
// fallback from a missing row). `job-safe-delivery` is authored for
// all four gates (default / fresh / returning / deep-recall).
const JOB_ID = "job-safe-delivery";

/**
 * Replicate the served-page mloop-memory-bag derivation from
 * `aftersign/main.js` (search for `packetOutcomeFactObject` — the
 * ONE call site on the served page). Kept as a local helper so a
 * refactor that extracts this shape into its own module can update
 * both the served page and this test in one hop, and the test still
 * pins the SAME transform the served page runs at render time.
 *
 * @param {Array<{ kind?: string, object?: string }>} ioMemory
 * @returns {{ packetOutcome: string } | Record<string, never>}
 */
function servedPageMloopMemoryBag(
  ioMemory: Array<{ kind?: string; object?: string }>,
): { packetOutcome: string } | Record<string, never> {
  const packetOutcomeFactObject = ioMemory.find(
    (fact) => fact?.kind === "delivery-outcome",
  )?.object;
  return packetOutcomeFactObject
    ? { packetOutcome: packetOutcomeFactObject }
    : {};
}

describe("mloop memoryGate — SERVED-PAGE mloopMemory bag → gate", () => {
  it("fresh Io memory (no delivery-outcome facts) folds to the 'fresh' gate", () => {
    const bag = servedPageMloopMemoryBag([]);
    expect(bag).toEqual({});
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("fresh");
    expect(action.id).toBe("mloop-safe-delivery-take");
  });

  it("a sealed delivery-outcome fact folds to the 'returning' gate", () => {
    const bag = servedPageMloopMemoryBag([
      {
        kind: "delivery-outcome",
        object: "sealed",
      },
    ]);
    expect(bag).toEqual({ packetOutcome: "sealed" });
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("returning");
    expect(action.id).toBe("mloop-safe-delivery-again");
  });

  it("keeps a sealed delivery in the returning posture for Io's return visit", () => {
    const returningAction = getMloopAvailableAction(
      JOB_ID,
      servedPageMloopMemoryBag([
        { kind: "delivery-outcome", object: "sealed" },
      ]),
    );

    expect(returningAction.memoryGate).toBe("returning");
    expect(returningAction.id).toBe("mloop-safe-delivery-again");
  });

  it("an opened delivery-outcome fact folds to the 'deep-recall' gate", () => {
    const bag = servedPageMloopMemoryBag([
      {
        kind: "delivery-outcome",
        object: "opened",
      },
    ]);
    expect(bag).toEqual({ packetOutcome: "opened" });
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("deep-recall");
    expect(action.id).toBe("mloop-safe-delivery-again");
  });

  it("ignores non-delivery-outcome facts when deriving the bag", () => {
    const bag = servedPageMloopMemoryBag([
      {
        kind: "route-attention",
        object: "done",
      },
    ]);
    expect(bag).toEqual({});
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("fresh");
  });

  it("uses the FIRST delivery-outcome fact when multiple exist", () => {
    const bag = servedPageMloopMemoryBag([
      { kind: "delivery-outcome", object: "opened" },
      { kind: "delivery-outcome", object: "sealed" },
    ]);
    expect(bag).toEqual({ packetOutcome: "opened" });
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("deep-recall");
  });

  it("pins fresh / returning / deep-recall as three DISTINCT gates", () => {
    const freshBag = servedPageMloopMemoryBag([]);
    const returningBag = servedPageMloopMemoryBag([
      { kind: "delivery-outcome", object: "sealed" },
    ]);
    const openedBag = servedPageMloopMemoryBag([
      { kind: "delivery-outcome", object: "opened" },
    ]);

    const gates = new Set([
      getMloopAvailableAction(JOB_ID, freshBag).memoryGate,
      getMloopAvailableAction(JOB_ID, returningBag).memoryGate,
      getMloopAvailableAction(JOB_ID, openedBag).memoryGate,
    ]);
    expect(gates.size).toBe(3);
    expect(gates.has("fresh")).toBe(true);
    expect(gates.has("returning")).toBe(true);
    expect(gates.has("deep-recall")).toBe(true);
  });
});
