import { describe, expect, it } from "vitest";
import {
  buildIoRecognitionSnippets,
  selectIoRecognitionDialogue,
} from "./ioRecognitionOrchestration.ts";
import { buildIoRecognitionDialogueSnippets } from "./ioRecognitionDialogue.ts";

describe("selectIoRecognitionDialogue", () => {
  it("preserves the durable deep-recall outcome and its source facts", () => {
    const selected = selectIoRecognitionDialogue({
      playerId: "courier",
      packetSealed: false,
      memory: [
        { id: "delivery-1", kind: "delivery-outcome", object: "opened" },
        { id: "route-1", predicate: "kiosk-second-action", object: "done" },
      ],
    });

    expect(selected.tier).toBe("deep-recall");
    expect(selected.line).toContain("broken seal, clean listening");
    expect(selected.memoryRefs).toEqual(["delivery-1"]);
    expect(selected.sourceMemoryIds).toEqual(["delivery-1", "route-1"]);
  });
});
