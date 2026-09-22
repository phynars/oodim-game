import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachIoReturnActionFeedback,
  IO_RETURN_ACTION_FEEL,
} from "./ioReturnActionFeedback.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("attachIoReturnActionFeedback", () => {
  it("presses to 0.96, releases over 180ms, then couples haptic and audio at 28ms", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    const haptic = vi.fn();
    const audio = vi.fn();
    const detach = attachIoReturnActionFeedback(button, { haptic, audio });

    button.dispatchEvent(new Event("pointerdown"));
    expect(button.dataset.ioReturnActionFeedback).toBe("pressed");
    expect(button.style.transform).toBe("scale(0.96)");
    expect(button.style.getPropertyValue("--io-return-action-press-scale")).toBe("0.96");

    button.dispatchEvent(new Event("pointerup"));
    expect(button.dataset.ioReturnActionFeedback).toBe("released");
    expect(button.style.transform).toBe("scale(1)");
    expect(button.style.transition).toContain(`${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms`);
    expect(haptic).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();

    vi.advanceTimersByTime(IO_RETURN_ACTION_FEEL.couplingDelayMs - 1);
    expect(haptic).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(audio).toHaveBeenCalledTimes(1);

    detach();
  });
});
