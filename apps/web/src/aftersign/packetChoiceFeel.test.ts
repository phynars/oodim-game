import { describe, expect, it } from "vitest";

import {
  createPacketChoiceFeelModel,
  defaultPacketChoiceTuning,
} from "./packetChoiceFeel";

describe("createPacketChoiceFeelModel", () => {
  it("requires a deliberate hold before opening the packet", () => {
    const choice = createPacketChoiceFeelModel({ holdMs: 420 });

    expect(
      choice.start({
        choice: "open",
        nowMs: 1000,
        pointerX: 120,
        pointerY: 180,
        axis: 0.7,
      }),
    ).toMatchObject({
      phase: "pressing",
      choice: "open",
      progress: 0,
      committedChoice: null,
    });

    expect(
      choice.update({
        nowMs: 1419,
        pointerX: 121,
        pointerY: 181,
        axis: 0.7,
      }),
    ).toMatchObject({
      phase: "pressing",
      choice: "open",
      progress: 419 / 420,
      committedChoice: null,
    });

    expect(
      choice.update({
        nowMs: 1420,
        pointerX: 121,
        pointerY: 181,
        axis: 0.7,
      }),
    ).toMatchObject({
      phase: "committed",
      choice: "open",
      progress: 1,
      committedChoice: "open",
    });
  });

  it("makes preserving the seal an equally explicit hold", () => {
    const choice = createPacketChoiceFeelModel({ holdMs: 420 });

    choice.start({
      choice: "preserve",
      nowMs: 2000,
      pointerX: 40,
      pointerY: 64,
      axis: -0.8,
    });

    expect(
      choice.update({
        nowMs: 2420,
        pointerX: 40,
        pointerY: 64,
        axis: -0.8,
      }),
    ).toMatchObject({
      phase: "committed",
      choice: "preserve",
      progress: 1,
      committedChoice: "preserve",
    });
  });

  it("cancels instead of committing when the pointer drifts like a stray swipe", () => {
    const choice = createPacketChoiceFeelModel();

    choice.start({
      choice: "open",
      nowMs: 0,
      pointerX: 100,
      pointerY: 100,
      axis: 0.8,
    });

    expect(
      choice.update({
        nowMs: defaultPacketChoiceTuning.holdMs,
        pointerX: 100 + defaultPacketChoiceTuning.cancelRadiusPx + 1,
        pointerY: 100,
        axis: 0.8,
      }),
    ).toMatchObject({
      phase: "cancelled",
      choice: "open",
      committedChoice: null,
    });
  });

  it("cancels when the player crosses away from the selected side", () => {
    const choice = createPacketChoiceFeelModel();

    choice.start({
      choice: "preserve",
      nowMs: 0,
      pointerX: 100,
      pointerY: 100,
      axis: -0.8,
    });

    expect(
      choice.update({
        nowMs: 200,
        pointerX: 100,
        pointerY: 100,
        axis: 0.1,
      }),
    ).toMatchObject({
      phase: "cancelled",
      choice: "preserve",
      committedChoice: null,
    });
  });
});
