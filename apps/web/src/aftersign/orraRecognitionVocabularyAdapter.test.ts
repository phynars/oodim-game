import { describe, expect, it } from "vitest";

import {
  fromRuntimeLaneMemory,
  toRuntimeLaneMemory,
  type OrraRecognitionHarnessRecord,
} from "./orraRecognitionVocabularyAdapter";

describe("orraRecognitionVocabularyAdapter", () => {
  it("round-trips a lit recognition record through runtime vocabulary", () => {
    const harnessRecord: OrraRecognitionHarnessRecord = {
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "lit",
      recognitionFeel: "orra-recognition-feel",
    };

    const runtimeMemory = toRuntimeLaneMemory(harnessRecord);
    expect(runtimeMemory).toEqual({
      remembersPlayer: true,
      action: "lit",
    });

    const roundTripped = fromRuntimeLaneMemory(runtimeMemory, harnessRecord.recognitionFeel);
    expect(roundTripped).toEqual(harnessRecord);
  });

  it("round-trips a spared recognition record through runtime vocabulary", () => {
    const harnessRecord: OrraRecognitionHarnessRecord = {
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: true,
      orraAction: "spared",
      recognitionFeel: "orra-recognition-feel",
    };

    const runtimeMemory = toRuntimeLaneMemory(harnessRecord);
    expect(runtimeMemory).toEqual({
      remembersPlayer: true,
      action: "spared",
    });

    const roundTripped = fromRuntimeLaneMemory(runtimeMemory, harnessRecord.recognitionFeel);
    expect(roundTripped).toEqual(harnessRecord);
  });

  it("normalizes non-recognition runtime memory to null action/feel", () => {
    const roundTripped = fromRuntimeLaneMemory(
      { remembersPlayer: false, action: "lit" },
      "orra-recognition-feel",
    );

    expect(roundTripped).toEqual({
      kind: "orra-recognition",
      scene: "orra-return",
      recognizesPlayer: false,
      orraAction: null,
      recognitionFeel: null,
    });
  });
});
