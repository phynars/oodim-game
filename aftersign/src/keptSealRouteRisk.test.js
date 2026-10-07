// Pure-lane check bundle for `routeRiskMemoryForPacketChoice` — the
// kept-seal filter that drops `repair-the-loss` from the route-risk
// tray at `packet-choice` when there is NO recorded prior run.
//
// Why this bundle exists:
//   The rule has one served-page witness (an e2e); this bundle pins the
//   same rule in the pure lane so the e2e is not the only evidence. The
//   hide keys off `routeRisk == null` alone — "no memory on record →
//   nothing to repair" — so there is no runtime premise about
//   `packet.sealed`, and every branch of the pure function is covered
//   below.
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
//   - signature pins that the function takes a SINGLE `routeRisk` arg —
//     Soren's PR #2206 review flagged the prior unread `packet` param;
//     the pin below makes a reintroduction of that premise a red test.

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
    const result = routeRiskMemoryForPacketChoice(null);
    assertEqual(result.memory, null, "null memory passes through as null");
    assertDeepEqual(
      result.hideActions,
      ["repair-the-loss"],
      "null memory hides repair-the-loss",
    );
  }

  // Branch 2 — undefined memory, same signal as null.
  {
    const result = routeRiskMemoryForPacketChoice(undefined);
    assertEqual(result.memory, null, "undefined memory normalizes to null");
    assertDeepEqual(
      result.hideActions,
      ["repair-the-loss"],
      "undefined memory hides repair-the-loss",
    );
  }

  // Branch 3 — a RECORDED failure legitimately offers repair-the-loss.
  // Memory passes through unchanged so `computeOfferedActions` keeps
  // owning the offer set for recorded runs.
  {
    const failedMemory = { lastRoute: "fast", succeeded: false };
    const result = routeRiskMemoryForPacketChoice(failedMemory);
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

  // Branch 4 — a recorded success passes through unchanged.
  // `computeOfferedActions`'s successful branches already exclude
  // `repair-the-loss`, so we don't need to hide anything.
  {
    const safeMemory = { lastRoute: "safe", succeeded: true };
    const fastMemory = { lastRoute: "fast", succeeded: true };
    const resultSafe = routeRiskMemoryForPacketChoice(safeMemory);
    const resultFast = routeRiskMemoryForPacketChoice(fastMemory);
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

  // Branch 5 — the function is pure (same input → same output,
  // repeated calls return structurally equal results).
  {
    const a = routeRiskMemoryForPacketChoice(null);
    const b = routeRiskMemoryForPacketChoice(null);
    assertDeepEqual(a, b, "same input yields structurally equal output");
    assert(a !== b, "but a fresh object each call (no cached singleton)");
  }

  // Branch 6 — signature pin: the function takes exactly ONE parameter
  // (the routeRisk memory). Soren's PR #2206 REQUEST_CHANGES flagged
  // the prior `packet` arg as unread; pinning `.length === 1` here
  // makes a reintroduction of that premise a red test, not a quiet
  // signature drift.
  {
    assertEqual(
      routeRiskMemoryForPacketChoice.length,
      1,
      "helper takes exactly one declared parameter (no reintroduced packet arg)",
    );
  }
};
