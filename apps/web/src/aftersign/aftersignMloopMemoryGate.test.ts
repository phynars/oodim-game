// AFTERSIGN — pin the served-page mloop memory-gate derivation.
//
// PR #1642 blocker (Soren's second REQUEST_CHANGES). The e2e
// `aftersign/e2e/m-loop-divergent-offered-actions.playtest.spec.ts`
// asserts that a FRESH seed and a RETURNING seed produce divergent
// `data-mloop-memory-gate` attribute sets. The served-page renderer
// derives the memory bag it hands `getMloopAvailableAction` via
// `offeredJobsMemoryFromIoMemory(state.npcs.io.memory)`, whose
// output shape is:
//
//   fresh (empty memory)                    → undefined
//   memory with a `sealed` outcome fact     → { priorOutcome: "completed" }
//   memory with only `opened` outcome facts → { debtHeld: <count> }
//
// The prior `memoryGateFor` in `aftersign/mloop-copy.js` only read
// `packetOutcome`, which those bags NEVER carry — so both fresh and
// returning seeds fell through to `"fresh"`/`"default"` at render
// time and the divergence assertion failed.
//
// This test feeds the three shapes `offeredJobsMemoryFromIoMemory`
// can emit straight through `getMloopAvailableAction` and pins the
// gate flip. A regression that quietly reverts `memoryGateFor` back
// to `packetOutcome`-only reading will collapse the three assertions
// below to a single "fresh" gate — an unmissable red.
//
// Kept apart from `aftersignMloopDivergence.contract.test.ts` (which
// pins the SELECTION axis via `selectIoJobOffers`) because this file
// pins the ACTION-GATE axis via `getMloopAvailableAction`. They are
// two different consumers of the same underlying memory posture and
// both need to diverge for the e2e to go green.

import { describe, expect, it } from "vitest";
// The served page (`aftersign/main.js`) imports both these modules
// straight from `aftersign/`. This test does the same so a reshape
// of either import contract lights up here.
// eslint-disable-next-line import/no-relative-parent-imports
import { getMloopAvailableAction } from "../../../../aftersign/mloop-copy.js";
// eslint-disable-next-line import/no-relative-parent-imports
import { offeredJobsMemoryFromIoMemory } from "../../../../aftersign/src/offeredJobsMemoryFromIoMemory.js";
// eslint-disable-next-line import/no-relative-parent-imports
import {
  NPC_MEMORY_FACT_KIND,
  NPC_MEMORY_OBJECT,
} from "../../../../aftersign/src/npcMemoryFlagSchema.js";

// A representative jobId from the mloop-copy action table so the row
// exists and the returned `memoryGate` is the axis under test (not a
// fallback from a missing row). `job-safe-delivery` is authored for
// all four gates (default / fresh / returning / deep-recall).
const JOB_ID = "job-safe-delivery";

describe("mloop memoryGate — served-page memory bag → gate", () => {
  it("maps a fresh (empty) Io memory to the 'fresh' gate", () => {
    const bag = offeredJobsMemoryFromIoMemory([]);
    expect(bag).toBeUndefined();
    const action = getMloopAvailableAction(JOB_ID, bag);
    // An `undefined` bag folds to the default posture, which the
    // action-table's `default` row is authored for and which the
    // e2e treats as fresh-equivalent.
    expect(action.memoryGate).toBe("default");
  });

  it("maps a returning (sealed-outcome) Io memory to the 'returning' gate", () => {
    const bag = offeredJobsMemoryFromIoMemory([
      {
        kind: NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME,
        object: NPC_MEMORY_OBJECT.PACKET_SEALED,
      },
    ]);
    expect(bag).toEqual({ priorOutcome: "completed" });
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("returning");
  });

  it("maps a debt-held (opened-outcome) Io memory to the 'deep-recall' gate", () => {
    const bag = offeredJobsMemoryFromIoMemory([
      {
        kind: NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME,
        object: NPC_MEMORY_OBJECT.PACKET_OPENED,
      },
    ]);
    expect(bag).toEqual({ debtHeld: 1 });
    const action = getMloopAvailableAction(JOB_ID, bag);
    expect(action.memoryGate).toBe("deep-recall");
  });

  it("pins the three gates as three DISTINCT values", () => {
    // The e2e's load-bearing assertion is `returningKeys !=== freshKeys`
    // at the fingerprint level, and the fingerprint includes
    // `gate:${memoryGate}`. If any two of these ever collapse to
    // the same string, the divergence assertion goes red — pin the
    // distinctness explicitly so a future edit to `memoryGateFor`
    // cannot silently flatten the axis.
    const freshBag = offeredJobsMemoryFromIoMemory([]);
    const returningBag = offeredJobsMemoryFromIoMemory([
      {
        kind: NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME,
        object: NPC_MEMORY_OBJECT.PACKET_SEALED,
      },
    ]);
    const debtHeldBag = offeredJobsMemoryFromIoMemory([
      {
        kind: NPC_MEMORY_FACT_KIND.DELIVERY_OUTCOME,
        object: NPC_MEMORY_OBJECT.PACKET_OPENED,
      },
    ]);

    const gates = new Set([
      getMloopAvailableAction(JOB_ID, freshBag).memoryGate,
      getMloopAvailableAction(JOB_ID, returningBag).memoryGate,
      getMloopAvailableAction(JOB_ID, debtHeldBag).memoryGate,
    ]);
    expect(gates.size).toBe(3);
  });

  it("still honors the legacy packetOutcome consumer-test shape", () => {
    // The existing consumer suites (`aftersignConfirmFeel.consumer.test.ts`
    // and friends) construct `{ packetOutcome: "sealed"|"opened" }`
    // bags directly. `memoryGateFor` reads BOTH shapes so this
    // migration does not force a rewrite of those tests.
    expect(
      getMloopAvailableAction(JOB_ID, { packetOutcome: "sealed" }).memoryGate,
    ).toBe("returning");
    expect(
      getMloopAvailableAction(JOB_ID, { packetOutcome: "opened" }).memoryGate,
    ).toBe("deep-recall");
  });
});
