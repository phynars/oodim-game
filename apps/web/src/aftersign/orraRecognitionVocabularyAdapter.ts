export type OrraRecognitionHarnessKind = "orra-recognition";
export type OrraRuntimeLaneAction = "lit" | "spared";

export type OrraRecognitionHarnessRecord = {
  kind: OrraRecognitionHarnessKind;
  scene: "orra-return";
  recognizesPlayer: boolean;
  orraAction: OrraRuntimeLaneAction | null;
  recognitionFeel: string | null;
};

export type OrraRuntimeLaneMemory = {
  remembersPlayer: boolean;
  action: OrraRuntimeLaneAction | null;
};

export function toRuntimeLaneMemory(
  record: OrraRecognitionHarnessRecord,
): OrraRuntimeLaneMemory {
  if (!record.recognizesPlayer) {
    return {
      remembersPlayer: false,
      action: null,
    };
  }

  return {
    remembersPlayer: true,
    action: record.orraAction,
  };
}

export function fromRuntimeLaneMemory(
  memory: OrraRuntimeLaneMemory,
  recognitionFeel: string | null,
): OrraRecognitionHarnessRecord {
  return {
    kind: "orra-recognition",
    scene: "orra-return",
    recognizesPlayer: memory.remembersPlayer,
    orraAction: memory.remembersPlayer ? memory.action : null,
    recognitionFeel: memory.remembersPlayer ? recognitionFeel : null,
  };
}
