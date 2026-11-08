import { afterEach, describe, expect, it, vi } from "vitest";
import { createIoReturnActionFeedbackController } from "./ioReturnActionFeedbackController.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function setup(initialState = {}) {
  let state = initialState;
  const armFeedback = vi.fn();
  const playAudio = vi.fn();
  const controller = createIoReturnActionFeedbackController({
    getState: () => state,
    armFeedback,
    playAudio,
    audioCue: "io-return-action",
  });
  return {
    controller,
    armFeedback,
    playAudio,
    setState: (next) => {
      state = next;
    },
    getState: () => state,
  };
}

describe("createIoReturnActionFeedbackController", () => {
  it("arms on document exactly once", () => {
    const { controller, armFeedback } = setup();
    controller.armOnce();
    controller.armOnce();
    expect(armFeedback).toHaveBeenCalledTimes(1);
    expect(armFeedback.mock.calls[0][0]).toBe(document);
  });

  it("stamps lastCue and lastCueAt before playing audio", () => {
    const { controller, armFeedback, playAudio, getState } = setup();
    playAudio.mockImplementation(() => {
      expect(getState()._runtime.audio.lastCue).toBe("io-return-action");
      expect(typeof getState()._runtime.audio.lastCueAt).toBe("number");
    });
    controller.armOnce();
    const { audio } = armFeedback.mock.calls[0][1];
    audio();
    expect(playAudio).toHaveBeenCalledTimes(1);
  });

  it("reads state late-bound at fire time, not at arm time", () => {
    const { controller, armFeedback, setState } = setup({ id: "old" });
    controller.armOnce();
    const fresh = { id: "fresh" };
    setState(fresh);
    armFeedback.mock.calls[0][1].audio();
    expect(fresh._runtime.audio.lastCue).toBe("io-return-action");
  });

  it("vibrates 28ms when navigator.vibrate exists", () => {
    const vibrate = vi.fn();
    const original = navigator.vibrate;
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true, writable: true });
    try {
      const { controller, armFeedback } = setup();
      controller.armOnce();
      armFeedback.mock.calls[0][1].haptic();
      expect(vibrate).toHaveBeenCalledWith(28);
    } finally {
      Object.defineProperty(navigator, "vibrate", { value: original, configurable: true, writable: true });
    }
  });
});
