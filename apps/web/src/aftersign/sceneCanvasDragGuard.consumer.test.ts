// Served-surface consumer test for the SCENE CANVAS drift-gate guard
// (PR #2230).
//
// Why this file exists (Soren PR #2230 re-review, AI003):
//   The prior Playwright draft at
//   `aftersign/e2e/kiosk-interaction-loop.playtest.spec.ts` tried to
//   drive the guard with `page.mouse.move/down/up` at the screen
//   coordinates of the DOM offer button `#job-offer-job-safe-delivery`.
//   Playwright dispatches pointer events to the TOPMOST hit element,
//   so the DOM button swallowed those events and the canvas
//   listeners the fix added (in `aftersign/src/runtime/inputAdapters.js`)
//   never saw the gesture. Asserting `lastAction === null` against a
//   code path that was never exercised is a tautology — it would pass
//   with or without the fix.
//
// What this file actually proves:
//   The guard lives on `canvas.pointerdown` / `canvas.pointerup` in
//   `attachRuntimeInputAdapters(...)`. Prior to PR #2230,
//   `handleScenePointer` was called on `pointerdown` — the first frame
//   of a camera-look drag committed the interaction. The fix delays
//   delivery to `pointerup` and demands total pointer travel
//   ≤ SCENE_TAP_DRIFT_PX (12).
//
//   This test attaches the SHIPPED `attachRuntimeInputAdapters` with
//   a vi.fn() `handleScenePointer`, dispatches real pointer events on
//   a real HTMLCanvasElement, and asserts:
//     1. A no-drift pointerdown/pointerup pair DOES call
//        `handleScenePointer` on the pointerup side.
//     2. A pointerdown/pointerup pair with travel > 12px does NOT
//        call `handleScenePointer`.
//     3. A pointerdown with NO pointerup (an incomplete gesture) does
//        NOT call `handleScenePointer` — proving the fix moved the
//        trigger off pointerdown as advertised.
//     4. A pointercancel between down and up suppresses the forward.
//
//   Collectively (1) + (2) rule out two tautology failure modes: (1)
//   proves the test is wired to the right code path; (2) proves the
//   drift gate is doing real work.
//
// AI003 fix: no fabricated listener; the test drives the shipped
// `attachRuntimeInputAdapters` end-to-end through real event
// dispatch on a real canvas element.

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachRuntimeInputAdapters } from "../../../../aftersign/src/runtime/inputAdapters.js";

type AttachRuntimeArgs = Parameters<typeof attachRuntimeInputAdapters>[0];

// Minimal harness: build the arg bundle `attachRuntimeInputAdapters`
// wants, with the canvas listener's dependencies real and everything
// else stubbed. The scene drift-gate guard reads only `canvas`,
// `handleScenePointer`, and the event stream — nothing else on the
// adapter's surface influences this code path.
function buildAdapterArgs(dom: JSDOM): {
  args: AttachRuntimeArgs;
  canvas: HTMLCanvasElement;
  handleScenePointer: ReturnType<typeof vi.fn>;
} {
  const { window: jsdomWindow, document } = dom.window as unknown as {
    window: Window & typeof globalThis;
    document: Document;
  };

  const canvas = document.createElement("canvas");
  canvas.id = "scene";
  document.body.appendChild(canvas);

  const orphanButton = document.createElement("button");
  document.body.appendChild(orphanButton);

  const handleScenePointer = vi.fn();

  const args = {
    packetButton: orphanButton,
    acknowledgeRouteButton: orphanButton,
    skipRouteButton: orphanButton,
    deliverButton: orphanButton,
    canvas,
    document,
    window: jsdomWindow,
    state: {
      interaction: {
        packetIntent: { active: false, config: { DRIFT_CANCEL_PX: 14 } },
      },
      player: {},
    },
    IO_RETURN_TONE_OPTIONS: [],
    AFTERSIGN_TAP_CHOICE_SURFACE_SELECTOR: "[data-aftersign-tap-choice]",
    packetPress: vi.fn(),
    packetMove: vi.fn(),
    packetRelease: vi.fn(),
    handleScenePointer,
    choose: vi.fn(),
    markStateDirty: vi.fn(),
    markPointerIntent: vi.fn(),
  } as unknown as AttachRuntimeArgs;

  return { args, canvas, handleScenePointer };
}

// Build a PointerEvent-ish MouseEvent in JSDOM, which does not ship
// the full PointerEvent constructor. The adapter's guard reads
// `pointerId`, `clientX`, `clientY` — those are what we layer in.
function dispatchPointerEvent(
  dom: JSDOM,
  target: HTMLElement,
  type: "pointerdown" | "pointerup" | "pointercancel",
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

describe("#scene canvas drift-gate guard (drives real inputAdapters.js — PR #2230)", () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  });

  afterEach(() => {
    dom.window.close();
  });

  it("POSITIVE: a no-drift pointerdown/pointerup pair on #scene calls handleScenePointer", () => {
    // Wiring witness. If this reds, the test is not reaching the
    // canvas listeners at all and every negative case below would
    // pass vacuously. Must green against the shipped adapter.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    expect(
      handleScenePointer,
      "pointerdown alone must NOT forward (fix moved trigger to pointerup)",
    ).not.toHaveBeenCalled();

    dispatchPointerEvent(dom, canvas, "pointerup", 7, 100, 100);
    expect(
      handleScenePointer,
      "pointerup within drift threshold MUST forward through the guard",
    ).toHaveBeenCalledTimes(1);
  });

  it("NEGATIVE: a pointerdown/pointerup pair with travel > 12px does NOT call handleScenePointer", () => {
    // Load-bearing negative. The pre-fix adapter delivered on
    // pointerdown and ignored travel, so it would have called
    // handleScenePointer on the pointerdown above. The shipped
    // adapter's drift gate (SCENE_TAP_DRIFT_PX = 12) must reject
    // this gesture at the pointerup check.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    // 48px horizontal drag — well over the 12px drift envelope.
    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 7, 148, 100);

    expect(
      handleScenePointer,
      "a 48px drag must NOT be delivered as a scene tap",
    ).not.toHaveBeenCalled();
  });

  it("NEGATIVE: a diagonal pointerdown/pointerup past the drift envelope does NOT forward", () => {
    // Hypotenuse check — the gate reads `Math.hypot(dx, dy)` so a
    // 10px / 10px diagonal (hypot ≈ 14.14) must still be rejected.
    // Guards against a buggy max(abs(dx), abs(dy)) implementation
    // that would wrongly accept a diagonal 10/10 as "within 12".
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 7, 110, 110);

    expect(
      handleScenePointer,
      "a 10/10 diagonal (hypot ≈ 14.14) exceeds the 12px envelope and must NOT forward",
    ).not.toHaveBeenCalled();
  });

  it("POSITIVE: a small jitter within the drift envelope still forwards (hypot ≤ 12)", () => {
    // Players rarely tap with sub-pixel precision — a tap with a
    // few pixels of unintentional jitter must still commit. This
    // pins the gate at `hypot > 12` strictly, not an over-eager
    // `hypot > 0`.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    // 3/4 right-triangle — hypot = 5, well inside the envelope.
    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 7, 103, 104);

    expect(
      handleScenePointer,
      "a 5px hypot tap (within 12px envelope) MUST forward",
    ).toHaveBeenCalledTimes(1);
  });

  it("NEGATIVE: a pointerdown with NO pointerup does NOT call handleScenePointer", () => {
    // Direct proof that the fix moved the trigger off pointerdown.
    // Pre-fix: handleScenePointer fired on pointerdown. Post-fix:
    // only pointerup fires it. This case would GREEN pre-fix only
    // if the adapter wrongly fired on both — the fix cannot be in
    // place if this test reds.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    // No pointerup. The player has started a press that hasn't
    // completed yet. The scene must NOT activate.

    expect(
      handleScenePointer,
      "pointerdown alone must never commit a scene tap (fix moved trigger to pointerup)",
    ).not.toHaveBeenCalled();
  });

  it("NEGATIVE: a pointercancel between down and up suppresses the forward", () => {
    // The OS tells us the gesture aborted (capture loss, blur,
    // higher-priority stream). The adapter clears its stored
    // pointerdown so a subsequent stray pointerup cannot forward.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointercancel", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 7, 100, 100);

    expect(
      handleScenePointer,
      "a pointercancel must clear the stored press so the following pointerup is a no-op",
    ).not.toHaveBeenCalled();
  });

  it("NEGATIVE: a pointerup from a DIFFERENT pointerId does NOT match the stored press", () => {
    // Multi-touch defensive pin: finger A presses, finger B lifts
    // elsewhere. The adapter keys the match on pointerId; the
    // non-matching pointerup must be dropped.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 9, 100, 100);

    expect(
      handleScenePointer,
      "a pointerup from a non-matching pointerId must not satisfy the stored press",
    ).not.toHaveBeenCalled();
  });

  it("POSITIVE: a second clean tap after a rejected drag still forwards", () => {
    // Pin on the state reset: after a drag rejection, the next
    // genuine tap must still work. If the stored press isn't
    // cleared on reject, this test reds.
    const { args, canvas, handleScenePointer } = buildAdapterArgs(dom);
    attachRuntimeInputAdapters(args);

    // Rejected drag.
    dispatchPointerEvent(dom, canvas, "pointerdown", 7, 100, 100);
    dispatchPointerEvent(dom, canvas, "pointerup", 7, 148, 100);
    expect(handleScenePointer).not.toHaveBeenCalled();

    // Clean tap afterwards.
    dispatchPointerEvent(dom, canvas, "pointerdown", 8, 200, 200);
    dispatchPointerEvent(dom, canvas, "pointerup", 8, 200, 200);
    expect(
      handleScenePointer,
      "a clean tap after a rejected drag must still forward (state must reset)",
    ).toHaveBeenCalledTimes(1);
  });
});
