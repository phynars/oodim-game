// M-LOOP feel harness — FEEL-level pins over the SHIPPED route/risk
// contract (`apps/web/src/aftersign/routeRiskMemory.ts`).
//
// History: the first draft of this file invented a PARALLEL vocabulary
// (`lit-stair`/`dark-cut`, its own `RouteRiskMemory` shape) that did not
// match the already-wired contract the served surface renders
// (`AftersignRoute = 'fast' | 'safe'`, `computeOfferedActions`,
// `recordRouteRun` — consumed by `aftersign/main.js` via
// `#routeRiskChoice`, pinned by `routeRiskMemory.consumer.test.ts` +
// `servedSurface.contract.test.ts`). Review blocked it twice: divergent
// reimplementation, zero consumers. This rewrite deletes the parallel
// contract entirely and re-anchors every check on the shipped module.
//
// Consumer: `aftersign/pure-runner.ts` registers
// `runRouteRiskFeelChecks` in the blocking `test:aftersign:pure` lane —
// the same consumer discipline the ioSecondPacketCopy /
// failureStingFeedback bundles use. This bundle is executed by CI, not
// merely typechecked.
//
// What this adds that `routeRiskMemory.consumer.test.ts` does NOT
// already pin (no duplicate coverage):
//   1. CONSTANT CHOICE PRESSURE — every reachable memory state
//      (fresh + all four route/outcome facts) offers EXACTLY two
//      distinct actions. Never zero (dead board), never a pile
//      (tap-scale overload).
//   2. FAILURE IS FELT — `repair-the-loss` surfaces after any failed
//      run (and on the cold open) and NEVER after a success, so the
//      recovery beat reads as a consequence, not wallpaper.
//   3. NO ROUTE ECHO — a successful run never re-offers its own
//      route's signature action next run (fast success hides
//      `take-the-shortcut`; safe success hides `take-the-long-way`).
//      The board visibly remembers what you just did.
//   4. NO DEAD VOCABULARY — every member of
//      `AftersignOfferedAction` is reachable from some memory state,
//      so no authored action silently rots out of the loop.
//
// Extension contract (pure-runner checklist item 1): this file's sole
// relative import is `.ts`-extensioned, and the leaf it reaches
// (`routeRiskMemory.ts`) contains ZERO relative imports, so the whole
// subgraph resolves under `node --experimental-strip-types`.

import {
  computeOfferedActions,
  recordRouteRun,
  type AftersignOfferedAction,
  type AftersignRoute,
  type AftersignRouteRiskMemory,
} from "../../apps/web/src/aftersign/routeRiskMemory.ts";

const ROUTES: readonly AftersignRoute[] = ["fast", "safe"];
const OUTCOMES: readonly boolean[] = [true, false];

/** Every persisted memory fact a real run can produce. */
function allRunFacts(): AftersignRouteRiskMemory[] {
  return ROUTES.flatMap((route) =>
    OUTCOMES.map((succeeded) => recordRouteRun({ route, succeeded })),
  );
}

/** Fresh session (null memory) plus every reachable run fact. */
function allReachableMemories(): (AftersignRouteRiskMemory | null)[] {
  return [null, ...allRunFacts()];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function describeMemory(memory: AftersignRouteRiskMemory | null): string {
  return memory
    ? `${memory.lastRoute}/${memory.succeeded ? "succeeded" : "failed"}`
    : "fresh";
}

export function checkChoicePressureIsConstant(): void {
  for (const memory of allReachableMemories()) {
    const offered = computeOfferedActions(memory);
    assert(
      offered.length === 2,
      `every run must offer exactly two actions, got ${offered.length} for ${describeMemory(memory)}`,
    );
    assert(
      new Set(offered).size === 2,
      `offered actions must be distinct for ${describeMemory(memory)}`,
    );
  }
}

export function checkFailureIsFeltNextRun(): void {
  for (const route of ROUTES) {
    const afterFailure = computeOfferedActions(
      recordRouteRun({ route, succeeded: false }),
    );
    assert(
      afterFailure.includes("repair-the-loss"),
      `a failed ${route} run must surface repair-the-loss next run`,
    );

    const afterSuccess = computeOfferedActions(
      recordRouteRun({ route, succeeded: true }),
    );
    assert(
      !afterSuccess.includes("repair-the-loss"),
      `a successful ${route} run must NOT surface repair-the-loss`,
    );
  }

  // Cold open reads as "nothing banked yet" — the shipped contract
  // routes null memory to the recovery set. Pin it so a refactor that
  // special-cases the fresh session gets caught deliberately.
  assert(
    computeOfferedActions(null).includes("repair-the-loss"),
    "a fresh session must offer the recovery set",
  );
}

export function checkSuccessfulRouteIsNotEchoed(): void {
  const afterFastSuccess = computeOfferedActions(
    recordRouteRun({ route: "fast", succeeded: true }),
  );
  assert(
    !afterFastSuccess.includes("take-the-shortcut"),
    "a successful fast run must not immediately re-offer the shortcut",
  );

  const afterSafeSuccess = computeOfferedActions(
    recordRouteRun({ route: "safe", succeeded: true }),
  );
  assert(
    !afterSafeSuccess.includes("take-the-long-way"),
    "a successful safe run must not immediately re-offer the long way",
  );
}

export function checkNoDeadActionVocabulary(): void {
  const reachable = new Set<AftersignOfferedAction>();
  for (const memory of allReachableMemories()) {
    for (const action of computeOfferedActions(memory)) {
      reachable.add(action);
    }
  }

  const vocabulary: readonly AftersignOfferedAction[] = [
    "take-the-shortcut",
    "take-the-long-way",
    "repair-the-loss",
    "carry-a-fragile-packet",
  ];
  for (const action of vocabulary) {
    assert(
      reachable.has(action),
      `authored action is unreachable from every memory state: ${action}`,
    );
  }
}

export function runRouteRiskFeelChecks(): void {
  checkChoicePressureIsConstant();
  checkFailureIsFeltNextRun();
  checkSuccessfulRouteIsNotEchoed();
  checkNoDeadActionVocabulary();
}
