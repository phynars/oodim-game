// Pure-lane check bundle for `routeRiskMemoryForPacketChoice` — the
// kept-seal filter that drops `repair-the-loss` from the route-risk
// tray at `packet-choice` when there is NO recorded prior run.
//
// Why this bundle exists:
//   Soren's REQUEST_CHANGES on PR #2206 flagged AI001 (one e2e as the
//   only evidence this works) and AI008 (the earlier draft gated the
//   hide on `packet.sealed`, a runtime premise this module couldn't
//   verify in isolation). The fix: key the hide off `routeRisk == null`
//   alone — "no memory on record → nothing to repair" — AND pin every
//   branch of the resulting pure function here so the e2e isn't the
//   only witness.
//
// Branches pinned below:
//   - null memory      → memory stays null, `repair-the-loss` hidden.
//   - undefined memory → same (no-record signal is identical).
//   - failed memory    → memory passes through unchanged, no hide
//                        (a recorded failure IS a loss to repair —
//                        `computeOfferedActions`'s branch still owns
//                        the offer set).
//   - succeeded memory → memory passes through unchanged, no hide
//                        (`computeOfferedActions`'s successful branches
//                        already exclude `repair-the-loss`).
//   - packet arg is NOT read on the no-record branch (the dependency
//     on `packet.sealed` the earlier draft had is gone — same hide
//     regardless of seal state, which is the premise-free fix).

import { routeRiskMemoryForPacketChoice } from "./keptSealRouteRisk.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertEqual = (actual, expected, label) => {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
};

const assertDeepEqual = (actual, expected, label) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
};

export const runKeptSealRouteRiskChecks = () => {
  // Branch 1 — null memory → hide `repair-the-loss`.
  // This is the first-visit case the issue (#2194) targets: nothing has
  // been recorded, so there's no loss to repair. We keep the null-memory
  // offer set (so `take-the-long-way` stays, matching the recall-feel
  // spec that taps it on a fresh slot) and only drop recovery.
  {
    const result = routeRiskMemoryForPacketChoice({ sealed: true }, null);
    assertEqual(result.memory, null, "null memory passes through as null");
    assertDeepEqual(
      result.hideActions,
      ["repair-the-loss"],
      "null memory hides repair-the-loss",
    );
  }

  // Branch 2 — undefined memory, same signal as null.
  {
    const result = routeRiskMemoryForPacketChoice({ sealed: false }, undefined);
    assertEqual(result.memory, null, "undefined memory normalizes to null");
    assertDeepEqual(
      result.hideActions,
      ["repair-the-loss"],
      "undefined memory hides repair-the-loss",
    );
  }

  // Branch 3 — the hide fires INDEPENDENTLY of `packet.sealed`.
  // The whole point of the AI008 fix: no runtime premise about when
  // `packet.sealed` is written. Same no-record signal → same hide,
  // whether sealed is true, false, or the packet arg is missing.
  {
    const sealedTrue = routeRiskMemoryForPacketChoice({ sealed: true }, null);
    const sealedFalse = routeRiskMemoryForPacketChoice({ sealed: false }, null);
    const sealedMissing = routeRiskMemoryForPacketChoice({}, null);
    const packetNull = routeRiskMemoryForPacketChoice(null, null);
    const packetUndef = routeRiskMemoryForPacketChoice(undefined, null);
    assertDeepEqual(
      sealedTrue.hideActions,
      ["repair-the-loss"],
      "sealed=true hides repair-the-loss",
    );
    assertDeepEqual(
      sealedFalse.hideActions,
      ["repair-the-loss"],
      "sealed=false hides repair-the-loss (no runtime premise on seal)",
    );
    assertDeepEqual(
      sealedMissing.hideActions,
      ["repair-the-loss"],
      "missing sealed field hides repair-the-loss",
    );
    assertDeepEqual(
      packetNull.hideActions,
      ["repair-the-loss"],
      "null packet hides repair-the-loss",
    );
    assertDeepEqual(
      packetUndef.hideActions,
      ["repair-the-loss"],
      "undefined packet hides repair-the-loss",
    );
  }

  // Branch 4 — a RECORDED failure legitimately offers repair-the-loss.
  // Memory passes through unchanged so `computeOfferedActions` keeps
  // owning the offer set for recorded runs.
  {
    const failedMemory = { lastRoute: "fast", succeeded: false };
    const result = routeRiskMemoryForPacketChoice({ sealed: false }, failedMemory);
    assertEqual(
      result.memory,
      failedMemory,
      "failed memory passes through by reference",
    );
    assertDeepEqual(
      result.hideActions,
      [],
      "failed memory DOES offer repair-the-loss — nothing hidden",
    );
  }

  // Branch 5 — a recorded success passes through unchanged.
  // `computeOfferedActions`'s successful branches already exclude
  // `repair-the-loss`, so we don't need to hide anything.
  {
    const safeMemory = { lastRoute: "safe", succeeded: true };
    const fastMemory = { lastRoute: "fast", succeeded: true };
    const resultSafe = routeRiskMemoryForPacketChoice({ sealed: true }, safeMemory);
    const resultFast = routeRiskMemoryForPacketChoice({ sealed: false }, fastMemory);
    assertEqual(
      resultSafe.memory,
      safeMemory,
      "safe+succeeded memory passes through by reference",
    );
    assertDeepEqual(
      resultSafe.hideActions,
      [],
      "safe+succeeded memory hides nothing",
    );
    assertEqual(
      resultFast.memory,
      fastMemory,
      "fast+succeeded memory passes through by reference",
    );
    assertDeepEqual(
      resultFast.hideActions,
      [],
      "fast+succeeded memory hides nothing",
    );
  }

  // Branch 6 — the function is pure (same input → same output,
  // repeated calls return structurally equal results).
  {
    const a = routeRiskMemoryForPacketChoice({ sealed: true }, null);
    const b = routeRiskMemoryForPacketChoice({ sealed: true }, null);
    assertDeepEqual(a, b, "same input yields structurally equal output");
    assert(a !== b, "but a fresh object each call (no cached singleton)");
  }
};
