import { describe, expect, it } from "vitest";

import { createPacketIntentModel } from "./packetIntent";

describe("createPacketIntentModel", () => {
  it("keeps stray taps from opening the sealed packet", () => {
    const packet = createPacketIntentModel({ openHoldThresholdMs: 320 });

    expect(packet.startOpenHold()).toMatchObject({
      state: "opening",
      holdMs: 0,
      canCommitOpen: false,
    });

    expect(packet.updateOpenHold(96)).toMatchObject({
      state: "opening",
      holdMs: 96,
      canCommitOpen: false,
    });

    expect(packet.releaseOpenHold()).toMatchObject({
      state: "sealed",
      holdMs: 0,
      canCommitOpen: false,
    });
  });

  it("opens only after one deliberate hold reaches the threshold", () => {
    const packet = createPacketIntentModel({ openHoldThresholdMs: 320 });

    packet.startOpenHold();
    expect(packet.updateOpenHold(319)).toMatchObject({
      state: "opening",
      holdMs: 319,
      canCommitOpen: false,
    });

    expect(packet.updateOpenHold(1)).toMatchObject({
      state: "opening",
      holdMs: 320,
      canCommitOpen: true,
    });

    expect(packet.releaseOpenHold()).toMatchObject({
      state: "opened",
      holdMs: 0,
      canCommitOpen: false,
    });
  });

  it("lets preserving the seal be an explicit committed outcome", () => {
    const packet = createPacketIntentModel({ openHoldThresholdMs: 320 });

    packet.startOpenHold();
    packet.updateOpenHold(160);

    expect(packet.commitKeepSealed()).toMatchObject({
      state: "sealed",
      holdMs: 0,
      canCommitOpen: false,
    });

    expect(packet.snapshot()).toMatchObject({
      state: "sealed",
      holdMs: 0,
      thresholdMs: 320,
      canCommitOpen: false,
    });
  });
});
