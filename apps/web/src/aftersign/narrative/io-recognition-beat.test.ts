import { describe, expect, it } from "vitest";
import { beatReferencesOnlyAllowedMemory, selectIoRecognitionBeat, type IoSliceMemory } from "./io-recognition-beat";

const sealedMemory: IoSliceMemory = {
  packetOutcome: "sealed",
  returnedAfterClose: true,
};

const openedMemory: IoSliceMemory = {
  packetOutcome: "opened",
  returnedAfterClose: true,
};

describe("selectIoRecognitionBeat", () => {
  it("returns Io's sealed-packet recognition line with auditable memory refs", () => {
    const beat = selectIoRecognitionBeat(sealedMemory);

    expect(beat.npcId).toBe("io-vale");
    expect(beat.line).toBe("You came back. So did the blue seal, unbroken. That gives me two facts to trust.");
    expect(beat.trustPosture).toBe("trusted");
    expect(beat.authoredMemorySentence).toBe("Io remembers that the player delivered the blue packet sealed.");
    expect(beat.allowedMemoryRefs).toEqual(["returnedAfterClose", "packetOutcome:sealed"]);
    expect(beatReferencesOnlyAllowedMemory(beat, sealedMemory)).toBe(true);
  });

  it("returns Io's opened-packet recognition line without granting trust", () => {
    const beat = selectIoRecognitionBeat(openedMemory);

    expect(beat.npcId).toBe("io-vale");
    expect(beat.line).toBe("You came back. The seal did not. I can use one of those facts.");
    expect(beat.trustPosture).toBe("usable");
    expect(beat.authoredMemorySentence).toBe("Io remembers that the player opened the blue packet before delivery.");
    expect(beat.allowedMemoryRefs).toEqual(["returnedAfterClose", "packetOutcome:opened"]);
    expect(beatReferencesOnlyAllowedMemory(beat, openedMemory)).toBe(true);
  });

  it("can catch a recognition line bound to the wrong persisted packet outcome", () => {
    const beat = selectIoRecognitionBeat(openedMemory);

    expect(beatReferencesOnlyAllowedMemory(beat, sealedMemory)).toBe(false);
  });

  it("falls back to route-attention memory when packet outcome is not known", () => {
    const beat = selectIoRecognitionBeat({
      packetOutcome: "unknown",
      routeAttention: "skipped",
    });

    expect(beat.line).toBe("You found the box anyway. Next time, let me finish saving your life.");
    expect(beat.allowedMemoryRefs).toEqual(["routeAttention:skipped"]);
    expect(beatReferencesOnlyAllowedMemory(beat, { packetOutcome: "unknown", routeAttention: "skipped" })).toBe(true);
  });

  it("keeps staging data attached to every authored recognition beat", () => {
    const beat = selectIoRecognitionBeat(sealedMemory);

    expect(beat.staging).toEqual({
      camera: "short-recognition-push-in",
      signCue: "tram-kiosk-ledger-glow",
      audio: "low-bell-recognition-sting",
    });
  });
});
