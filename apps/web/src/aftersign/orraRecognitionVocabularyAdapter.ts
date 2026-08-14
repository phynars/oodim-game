// #1181 harness↔served reconciliation adapter.
//
// The served Orra lane (`aftersign/src/orraRecognitionMemory.ts`) is the
// AUTHORITATIVE vocabulary — its `OrraDeliberateAction` (currently
// `"lit" | "spared"`) is the enum a recognition record must ultimately
// speak in. The #863 harness surface uses a different (coarser) vocabulary:
// beats carry `AftersignOrraAction` (`"answered-saint-orra"`), a
// harness-only marker for "the player took Orra's deliberate action" that
// does not itself distinguish lit vs spared.
//
// The reconciliation contract, per the product-plan note "served lane wins,
// harness adapts":
//
//   1. The runtime lane vocabulary in this file is a TYPE ALIAS of the
//      served `OrraDeliberateAction` — not a hand-written union. If the
//      served enum grows a third action, `OrraRuntimeLaneAction` grows
//      with it, and every callsite that fed a two-arm resolver goes RED
//      at typecheck. That drift-catch is why this adapter exists.
//
//   2. `toRuntimeLaneMemory` requires an EXPLICIT resolver from the
//      harness vocabulary (`AftersignOrraAction`) to the served
//      vocabulary. The adapter itself refuses to invent a mapping — the
//      caller (test or future consumer) must supply one, typed against
//      the imported `OrraDeliberateAction`. This is the whole point:
//      served-lane growth propagates through the resolver signature into
//      every callsite.
//
//   3. `fromRuntimeLaneMemory` is the inverse projection back into the
//      harness beat shape. It emits `"answered-saint-orra"` whenever the
//      served memory carries any `OrraDeliberateAction` — the harness
//      vocabulary collapses lit/spared onto a single "did the action"
//      marker, and that's fine as long as the projection is total.

import { type OrraDeliberateAction } from "../../../../aftersign/src/orraRecognitionMemory";

import { type AftersignOrraAction } from "./verticalSliceRuntimeState";

export type OrraRecognitionHarnessKind = "orra-recognition";

/**
 * Runtime-lane action alias. This is IMPORTED from the served lane, not
 * hand-written — a third served action grows this type automatically,
 * which is what turns "served lane grew a case" into a typecheck failure
 * at every consumer that ignored the drift.
 */
export type OrraRuntimeLaneAction = OrraDeliberateAction;

export type OrraRecognitionHarnessRecord = {
  kind: OrraRecognitionHarnessKind;
  scene: "orra-return";
  recognizesPlayer: boolean;
  /**
   * The HARNESS vocabulary for the recognition-triggering action. Typed
   * against `AftersignOrraAction` (the shape `sampleAftersignOrraMemoryBeat`
   * actually emits) — deliberately not lit/spared, so the adapter must
   * translate rather than round-trip against itself.
   */
  orraAction: AftersignOrraAction | null;
  recognitionFeel: string | null;
};

export type OrraRuntimeLaneMemory = {
  remembersPlayer: boolean;
  action: OrraRuntimeLaneAction | null;
};

/**
 * Resolver signature the caller supplies to translate the harness's
 * coarse `AftersignOrraAction` marker into the served lane's finer
 * `OrraDeliberateAction`. Typed against the IMPORTED served enum so any
 * future case growth (e.g. a third action beyond lit/spared) forces
 * every existing resolver to declare its intent for the new case at
 * typecheck time.
 */
export type OrraRuntimeLaneActionResolver = (
  harnessAction: AftersignOrraAction,
) => OrraDeliberateAction;

export function toRuntimeLaneMemory(
  record: OrraRecognitionHarnessRecord,
  resolveRuntimeLaneAction: OrraRuntimeLaneActionResolver,
): OrraRuntimeLaneMemory {
  if (!record.recognizesPlayer || record.orraAction === null) {
    return {
      remembersPlayer: record.recognizesPlayer,
      action: null,
    };
  }

  return {
    remembersPlayer: true,
    action: resolveRuntimeLaneAction(record.orraAction),
  };
}

/**
 * Inverse projection: served-lane memory → harness beat record. The
 * harness vocabulary collapses lit/spared into `"answered-saint-orra"`
 * — the harness only records THAT the player did the action, not which
 * variant. Any served-lane action projects back to
 * `"answered-saint-orra"`, so the projection stays total as the served
 * enum grows.
 */
export function fromRuntimeLaneMemory(
  memory: OrraRuntimeLaneMemory,
  recognitionFeel: string | null,
): OrraRecognitionHarnessRecord {
  const projectedHarnessAction: AftersignOrraAction | null =
    memory.remembersPlayer && memory.action !== null ? "answered-saint-orra" : null;

  return {
    kind: "orra-recognition",
    scene: "orra-return",
    recognizesPlayer: memory.remembersPlayer,
    orraAction: projectedHarnessAction,
    recognitionFeel: memory.remembersPlayer ? recognitionFeel : null,
  };
}
