import { describe, expect, it } from "vitest";

// This contract deliberately names the copy module rather than repeating a dialogue
// literal. June's copy change must export the key and recall line used by the
// server-authoritative reload witness.
import {
  AFTERSIGN_MEMORY_RECALL,
  AFTERSIGN_MEMORY_RECALL_KEY,
} from "./aftersignMemoryRecallCopy";
import { loadDurableMemoryAfterReload, writeDurableMemory } from "./d1Memory";

describe("D1 memory reload", () => {
  it("restores the authored recall from durable state after reload", async () => {
    const playerId = "d1-reload-contract-player";

    await writeDurableMemory(playerId, AFTERSIGN_MEMORY_RECALL_KEY);
    const restored = await loadDurableMemoryAfterReload(playerId);

    expect(restored.recallKey).toBe(AFTERSIGN_MEMORY_RECALL_KEY);
    expect(restored.recallLine).toBe(AFTERSIGN_MEMORY_RECALL);
  });
});
