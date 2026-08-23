export type AftersignMemoryRecord = {
  readonly returnTone?: "warm" | "cold" | "plain";
  readonly packetOutcome: "opened" | "sealed" | null;
  readonly orraAction: "answered-saint-orra" | null;
};

export type AftersignOfferedAction = {
  readonly id: "carry-opened-packet" | "carry-sealed-packet" | "answer-for-orra";
  readonly label: string;
};

/**
 * The job board is deliberately a pure reading of the saved choices.
 * A renderer receives only these actions, so it has no non-offered action
 * available to place in the DOM.
 */
export function computeOfferedActions(
  memoryRecord: AftersignMemoryRecord,
): readonly AftersignOfferedAction[] {
  if (memoryRecord.orraAction === "answered-saint-orra") {
    return [{ id: "answer-for-orra", label: "Carry a reply for Orra" }];
  }
  if (memoryRecord.packetOutcome === "opened") {
    return [{ id: "carry-opened-packet", label: "Carry what was opened" }];
  }
  return [{ id: "carry-sealed-packet", label: "Carry what stayed sealed" }];
}
