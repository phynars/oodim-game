import { describe, expect, it, vi } from "vitest";

import { attachRuntimeInputAdapters } from "./inputAdapters.js";

function pointerEvent(type, pointerId, x, y) {
  const event = new MouseEvent(type, {
    bubbles: true,
    detail: type === "click" ? 1 : 0,
    clientX: x,
    clientY: y,
  });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  return event;
}

function setup() {
  document.body.innerHTML = "";
  const button = document.createElement("button");
  button.dataset.choiceId = "return-to-io";
  document.body.appendChild(button);
  const choose = vi.fn();
  const state = { interaction: {}, scene: {} };
  attachRuntimeInputAdapters({
    packetButton: document.createElement("button"),
    acknowledgeRouteButton: button,
    skipRouteButton: document.createElement("button"),
    deliverButton: document.createElement("button"),
    canvas: document.createElement("canvas"),
    document,
    window,
    state,
    IO_RETURN_TONE_OPTIONS: [],
    AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR: "[data-aftersign-tap-choice]",
    packetPress: vi.fn(),
    packetMove: vi.fn(),
    packetRelease: vi.fn(),
    handleScenePointer: vi.fn(),
    choose,
    commitPacketOutcome: vi.fn(),
    PACKET_OUTCOME: {},
    markStateDirty: vi.fn(),
    markPointerIntent: vi.fn(),
  });
  return { button, choose };
}

describe("return-surface swipe guard", () => {
  it("does not activate Return to Io after a 300px swipe", () => {
    const { button, choose } = setup();
    button.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    button.dispatchEvent(pointerEvent("click", 1, 100, 400));
    expect(choose).not.toHaveBeenCalled();
  });

  it("activates Return to Io after a tap", () => {
    const { button, choose } = setup();
    button.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    button.dispatchEvent(pointerEvent("click", 1, 103, 104));
    expect(choose).toHaveBeenCalledWith("return-to-io");
  });
});
