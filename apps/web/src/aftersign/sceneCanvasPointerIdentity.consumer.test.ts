import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachRuntimeInputAdapters } from "../../../../aftersign/src/runtime/inputAdapters.js";

type AttachRuntimeArgs = Parameters<typeof attachRuntimeInputAdapters>[0];

function dispatchPointerEvent(
  dom: JSDOM,
  target: HTMLElement,
  type: "pointerdown" | "pointerup",
  pointerId: number,
  clientX: number,
  clientY: number,
): void {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, "pointerId", { value: pointerId });
  target.dispatchEvent(event);
}

describe("#scene canvas tap identity guard", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  });

  afterEach(() => {
    dom.window.close();
  });

  // The novel claim here (vs. `sceneCanvasDragGuard.consumer.test.ts`,
  // which covers only the foreign-release-ignored case) is the SECOND
  // assertion: after the foreign `pointerup` is ignored, the ORIGINAL
  // finger's later release must still deliver a tap. That only holds
  // when the pointerup handler clears `scenePointerDown` solely on an
  // id match — the regression under test was an unconditional clear
  // that erased the stored press when any foreign release arrived.
  it("preserves the stored press across a foreign pointerup", () => {
    const { document, window } = dom.window;
    const canvas = document.createElement("canvas");
    const button = document.createElement("button");
    document.body.append(canvas, button);
    const handleScenePointer = vi.fn();

    attachRuntimeInputAdapters({
      packetButton: button,
      acknowledgeRouteButton: button,
      skipRouteButton: button,
      deliverButton: button,
      canvas,
      document,
      window,
      state: { interaction: { packetIntent: { active: false, config: { DRIFT_CANCEL_PX: 14 } } }, player: {} },
      IO_RETURN_TONE_OPTIONS: [],
      AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR: "[data-aftersign-tap-choice]",
      packetPress: vi.fn(),
      packetMove: vi.fn(),
      packetRelease: vi.fn(),
      handleScenePointer,
      choose: vi.fn(),
      markStateDirty: vi.fn(),
      markPointerIntent: vi.fn(),
    } as unknown as AttachRuntimeArgs);

    dispatchPointerEvent(dom, canvas, "pointerdown", 1, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 2, 100, 100);

    expect(handleScenePointer).not.toHaveBeenCalled();

    dispatchPointerEvent(dom, canvas, "pointerup", 1, 100, 100);
    expect(handleScenePointer).toHaveBeenCalledTimes(1);
  });
});
