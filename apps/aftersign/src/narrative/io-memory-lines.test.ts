import { describe, expect, it } from "vitest";

import {
  buildIoAuthoredMemorySentence,
  selectIoRecognitionBeat,
  type IoSliceMemoryRecord,
} from "./io-memory-lines";

const returnedWith = (memory: Partial<IoSliceMemoryRecord>): IoSliceMemoryRecord => ({
  completedDeliveryIds: [],
  ...memory,
});

describe("Io memory lines compatibility exports", () => {
  it("re-exports the consolidated recognition selector", () => {
    const beat = selectIoRecognitionBeat(
      returnedWith({
        completedDeliveryIds: ["io-blue-packet"],
        packetOutcome: "opened",
      }),
    );

    expect(beat.id).toBe("io-return-blue-seal-broken");
    expect(beat.line).toBe("You came back. The seal did not. I can use one of those facts.");
  });

  it("re-exports the authored memory sentence builder", () => {
    expect(
      buildIoAuthoredMemorySentence(
        returnedWith({
          completedDeliveryIds: ["io-blue-packet"],
          packetOutcome: "returned",
        }),
      ),
    ).toBe("the player returned the blue packet to Io");
  });
});
