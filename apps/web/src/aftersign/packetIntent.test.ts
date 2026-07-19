import {
  AFTERSIGN_PACKET_OPEN_HOLD_MS,
  createAftersignPacketIntentState,
  reduceAftersignPacketIntent,
} from "./packetIntent";

describe("Aftersign packet intent feel", () => {
  it("keeps inspection separate from the committed open choice", () => {
    const state = createAftersignPacketIntentState();

    expect(state).toEqual({
      intent: "inspect",
      holdStartedAtMs: null,
      heldForMs: 0,
      openedAtMs: null,
    });
  });

  it("opens only after a deliberate uninterrupted hold", () => {
    const pressed = reduceAftersignPacketIntent(createAftersignPacketIntentState(), {
      type: "press",
      nowMs: 1000,
    });
    const almost = reduceAftersignPacketIntent(pressed, {
      type: "tick",
      nowMs: 1000 + AFTERSIGN_PACKET_OPEN_HOLD_MS - 1,
      hasFocus: true,
    });
    const opened = reduceAftersignPacketIntent(almost, {
      type: "tick",
      nowMs: 1000 + AFTERSIGN_PACKET_OPEN_HOLD_MS,
      hasFocus: true,
    });

    expect(almost.intent).toBe("opening");
    expect(almost.heldForMs).toBe(AFTERSIGN_PACKET_OPEN_HOLD_MS - 1);
    expect(opened).toEqual({
      intent: "opened",
      holdStartedAtMs: 1000,
      heldForMs: AFTERSIGN_PACKET_OPEN_HOLD_MS,
      openedAtMs: 1000 + AFTERSIGN_PACKET_OPEN_HOLD_MS,
    });
  });

  it("cancels a partial hold on release so a tap cannot break Io's seal", () => {
    const pressed = reduceAftersignPacketIntent(createAftersignPacketIntentState(), {
      type: "press",
      nowMs: 2000,
    });
    const partial = reduceAftersignPacketIntent(pressed, {
      type: "tick",
      nowMs: 2000 + Math.floor(AFTERSIGN_PACKET_OPEN_HOLD_MS / 2),
      hasFocus: true,
    });
    const released = reduceAftersignPacketIntent(partial, {
      type: "release",
      nowMs: 2000 + Math.floor(AFTERSIGN_PACKET_OPEN_HOLD_MS / 2) + 1,
    });

    expect(partial.intent).toBe("opening");
    expect(released).toEqual(createAftersignPacketIntentState());
  });

  it("does not open from background or drifted input frames", () => {
    const pressed = reduceAftersignPacketIntent(createAftersignPacketIntentState(), {
      type: "press",
      nowMs: 3000,
    });
    const backgrounded = reduceAftersignPacketIntent(pressed, {
      type: "tick",
      nowMs: 3000 + AFTERSIGN_PACKET_OPEN_HOLD_MS + 100,
      hasFocus: false,
    });
    const drifted = reduceAftersignPacketIntent(pressed, {
      type: "move",
      nowMs: 3000 + AFTERSIGN_PACKET_OPEN_HOLD_MS + 100,
      stillWithinIntentRadius: false,
    });

    expect(backgrounded).toMatchObject({
      intent: "opening",
      heldForMs: AFTERSIGN_PACKET_OPEN_HOLD_MS + 100,
      openedAtMs: null,
    });
    expect(drifted).toEqual(createAftersignPacketIntentState());
  });
});
