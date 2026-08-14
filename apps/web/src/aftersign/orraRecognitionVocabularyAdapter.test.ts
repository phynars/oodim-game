import { describe, expect, it } from "vitest";

import { type OrraDeliberateAction } from "../../../../aftersign/src/orraRecognitionMemory";

import {
  fromRuntimeLaneMemory,
  toRuntimeLaneMemory,
  type OrraRecognitionHarnessRecord,
  type OrraRuntimeLaneAction,
  type OrraRuntimeLaneActionResolver,
} from "./orraRecognitionVocabularyAdapter";

// Compile-time drift-catch: `OrraRuntimeLaneAction` must be a TYPE ALIAS
// of the served-lane `OrraDeliberateAction`, not a hand-written copy.
// These bidirectional assignments only typecheck when the two types are
// mutually assignable — i.e. structurally identical. If a future change
// re-declares the runtime action as a local string union that drifts
// from the served enum, one of these lines goes RED at `tsc`.
const _laneToServed: OrraDeliberateAction = null as unknown as OrraRuntimeLaneAction;
const _servedToLane: OrraRuntimeLaneAction = null as unknown as OrraDeliberateAction;
void _laneToServed;
void _servedToLane;

/**
 * Test resolver mapping the harness's coarse "answered-saint-orra"
 * marker to the served lane's `"lit"`. Any handler that lands a third
 * served-lane action must extend the served enum, which flows through
 * this resolver's return type — the compiler will demand a case here.
 */
const resolveToLit: OrraRuntimeLaneActionResolver = () => "lit";
const resolveToSpared: OrraRuntimeLaneActionResolver = () => "spared";

describe("orraRecognitionVocabularyAdapter", () => {
  it("resolves a harness recognition record onto the lit served-lane action", () => {
    const harnessRecord: OrraRecognitionHarnessRecord = {
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "answered-saint-orra",
      recognitionFeel: "orra-recognition-feel",
    };

    const runtimeMemory = toRuntimeLaneMemory(harnessRecord, resolveToLit);
    expect(runtimeMemory).toEqual({
      remembersPlayer: true,
      action: "lit",
    });

    // Inverse projection collapses lit/spared back onto the harness
    // marker — that's the harness vocabulary being coarser than the
    // served vocabulary, by design.
    const projectedBack = fromRuntimeLaneMemory(runtimeMemory, harnessRecord.recognitionFeel);
    expect(projectedBack).toEqual(harnessRecord);
  });

  it("resolves a harness recognition record onto the spared served-lane action", () => {
    const harnessRecord: OrraRecognitionHarnessRecord = {
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "answered-saint-orra",
      recognitionFeel: "orra-recognition-feel",
    };

    const runtimeMemory = toRuntimeLaneMemory(harnessRecord, resolveToSpared);
    expect(runtimeMemory).toEqual({
      remembersPlayer: true,
      action: "spared",
    });

    // Because the harness marker collapses lit/spared, the inverse
    // projection lands on the same harness record shape either way.
    const projectedBack = fromRuntimeLaneMemory(runtimeMemory, harnessRecord.recognitionFeel);
    expect(projectedBack).toEqual(harnessRecord);
  });

  it("does not call the resolver when the harness record does not recognize the player", () => {
    let resolverCalls = 0;
    const trackingResolver: OrraRuntimeLaneActionResolver = () => {
      resolverCalls += 1;
      return "lit";
    };

    const runtimeMemory = toRuntimeLaneMemory(
      {
        kind: "orra-recognition",
        scene: "orra-return",
        recognizesPlayer: false,
        orraAction: null,
        recognitionFeel: null,
      },
      trackingResolver,
    );

    expect(runtimeMemory).toEqual({
      remembersPlayer: false,
      action: null,
    });
    expect(resolverCalls).toBe(0);
  });

  it("does not call the resolver when the harness record carries a null action", () => {
    let resolverCalls = 0;
    const trackingResolver: OrraRuntimeLaneActionResolver = () => {
      resolverCalls += 1;
      return "lit";
    };

    // Acquaintance without the deliberate action — recognized but
    // orraAction is null. The resolver must not be invoked, and the
    // runtime memory must carry a null action.
    const runtimeMemory = toRuntimeLaneMemory(
      {
        kind: "orra-recognition",
        scene: "orra-return",
        recognizesPlayer: true,
        orraAction: null,
        recognitionFeel: "orra-recognition-feel",
      },
      trackingResolver,
    );

    expect(runtimeMemory).toEqual({
      remembersPlayer: true,
      action: null,
    });
    expect(resolverCalls).toBe(0);
  });

  it("normalizes non-recognition runtime memory to null action/feel", () => {
    const projectedBack = fromRuntimeLaneMemory(
      { remembersPlayer: false, action: "lit" },
      "orra-recognition-feel",
    );

    expect(projectedBack).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: false,
      orraAction: null,
      recognitionFeel: null,
    });
  });
});
