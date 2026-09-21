// Served-surface consumer test for the CANCELLED packet-gesture
// failure sting (Refs #1698, PR #1871 draft 2).
//
// Why this file exists (Soren's SECOND blocking review on PR #1871):
//   Draft 1 attached its own `packetButton.addEventListener("click", ...)`
//   handler that ran `evaluatePacketChoiceGesture` + the sting writer
//   INSIDE the test itself. That was a tautological pin: the handler
//   under test was written BY the test, not the served page. Soren
//   flagged it as AI003 ("tautological test — mirrors an invented
//   dispatch rather than the served one") and AI006 ("unconsumed
//   surface — no wired importer in `aftersign/main.js` or
//   `inputAdapters.js`").
//
// Draft 2 closes both gaps by driving the SERVED adapter directly:
//
//   1. Load the REAL `aftersign/index.html` into JSDOM. Find the
//      shipped `#packetButton` element the finger actually touches.
//      If the button is missing this test reds — no drift between
//      the served markup and the render seam.
//   2. Call `attachRuntimeInputAdapters(...)` — the SAME function
//      `aftersign/main.js` calls at boot — passing in the DOM refs
//      + the same callbacks the served page provides. From this
//      point on every listener the test fires is the SHIPPED listener.
//   3. Dispatch a real `PointerEvent('pointerdown')` on the served
//      `#packetButton`, then a real `PointerEvent('pointercancel')`
//      — the exact browser edge that maps to "the OS told us the
//      gesture aborted." The served adapter runs the pure feel judge
//      and, on `reason: "cancelled"`, calls
//      `playPacketCancelFailureSting(#packetButton, ...)`.
//   4. Assert `#packetButton.animate` was called ONCE with the pinned
//      cancel-sting keyframes/duration/easing. The writer's decision
//      to fire is the served page's decision; the assertion pins
//      that decision landed on the exact element the finger touched.
//
// AI006 fix: the served `aftersign/src/runtime/inputAdapters.js`
// now imports `playPacketCancelFailureSting` and calls it in both
// `pointerup` and `pointercancel` — the shipped release funnel.
// AI003 fix: this test drives `attachRuntimeInputAdapters` end-to-end
// through real `PointerEvent` dispatch on the shipped node; no
// fabricated `addEventListener("click", ...)` handler in sight.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachRuntimeInputAdapters } from "../../../../aftersign/src/runtime/inputAdapters.js";
import {
  PACKET_CANCEL_FAILURE_STING,
  playPacketCancelFailureSting,
} from "./packetCancelFailureSting.js";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

type AttachRuntimeArgs = Parameters<typeof attachRuntimeInputAdapters>[0];

// Minimal harness: the shipped `attachRuntimeInputAdapters` signature
// wants a handful of DOM refs + callbacks. We provide the packet
// button (the surface under test) as a real JSDOM element and stub
// everything else that isn't on the packet-release path.
function buildAdapterArgs(dom: JSDOM, packetButton: HTMLButtonElement): {
  args: AttachRuntimeArgs;
  spies: {
    packetPress: ReturnType<typeof vi.fn>;
    packetMove: ReturnType<typeof vi.fn>;
    packetRelease: ReturnType<typeof vi.fn>;
  };
} {
  const { window: jsdomWindow, document } = dom.window as unknown as {
    window: Window & typeof globalThis;
    document: Document;
  };

  const orphan = document.createElement("button");

  const packetPress = vi.fn();
  const packetMove = vi.fn();
  const packetRelease = vi.fn();

  const args = {
    packetButton,
    acknowledgeRouteButton:
      (document.querySelector("#acknowledgeRoute") as HTMLButtonElement | null) ?? orphan,
    skipRouteButton:
      (document.querySelector("#skipRoute") as HTMLButtonElement | null) ?? orphan,
    deliverButton:
      (document.querySelector("#deliverPacket") as HTMLButtonElement | null) ?? orphan,
    canvas:
      (document.querySelector("canvas") as HTMLCanvasElement | null)
      ?? document.createElement("canvas"),
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
    packetPress,
    packetMove,
    packetRelease,
    handleScenePointer: vi.fn(),
    choose: vi.fn(),
    markStateDirty: vi.fn(),
    markPointerIntent: vi.fn(),
  } as unknown as AttachRuntimeArgs;

  return { args, spies: { packetPress, packetMove, packetRelease } };
}

function dispatchPointerdown(
  dom: JSDOM,
  target: HTMLElement,
  x: number,
  y: number,
): void {
  // JSDOM ships `Event` but not the full `PointerEvent` constructor
  // used by browsers. Sibling e2e tests dispatch real `PointerEvent`
  // in Playwright; here we use jsdom's `MouseEvent` and layer the
  // pointer fields the served adapter reads (pointerId, clientX/Y).
  const event = new dom.window.MouseEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

function dispatchPointercancel(
  dom: JSDOM,
  target: HTMLElement,
  x: number,
  y: number,
): void {
  const event = new dom.window.MouseEvent("pointercancel", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

function dispatchPointerup(
  dom: JSDOM,
  target: HTMLElement,
  x: number,
  y: number,
): void {
  const event = new dom.window.MouseEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
  }) as MouseEvent & { pointerId: number };
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

describe("#packetButton served-surface CANCELLED failure-sting contract (drives real inputAdapters.js)", () => {
  let dom: JSDOM;
  let packetButton: HTMLButtonElement;
  let animateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dom = new JSDOM(readServedIndexHtml());
    const button = dom.window.document.querySelector("#packetButton");
    if (!(button instanceof dom.window.HTMLButtonElement)) {
      throw new Error(
        "served aftersign/index.html must host a #packetButton element",
      );
    }
    packetButton = button as unknown as HTMLButtonElement;

    // jsdom implements neither `.animate` nor `.setPointerCapture` on
    // real elements. Stub both — the writer's animate call is the
    // observable we assert on; setPointerCapture is wrapped in
    // try/catch by the adapter so a throw wouldn't stop the press,
    // but a working stub keeps the harness quiet.
    animateSpy = vi.fn();
    (packetButton as unknown as { animate: typeof animateSpy }).animate =
      animateSpy;
    (packetButton as unknown as { setPointerCapture: (id: number) => void })
      .setPointerCapture = () => {
        /* jsdom no-op */
      };
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #packetButton element the served sting lands on", () => {
    // Baseline: if the served markup loses the button, the wire has
    // nothing to render on. Fires first so the failure points at the
    // DOM contract, not the writer.
    expect(packetButton).not.toBeNull();
    expect(packetButton.classList.contains("packet-button")).toBe(true);
    expect(packetButton.getAttribute("data-aftersign-tap-choice")).toBe(
      "packet",
    );
  });

  it("SERVED-PATH: attachRuntimeInputAdapters wires pointercancel on #packetButton to play the sting", () => {
    // The load-bearing pin. Attach the SHIPPED adapter to the SHIPPED
    // button, then drive a real pointerdown → pointercancel through
    // it. The served `pointercancel` handler runs
    // `evaluatePacketChoiceGesture({ kind: "cancel", ... })`, sees
    // `reason: "cancelled"`, and calls
    // `playPacketCancelFailureSting(#packetButton, ...)`. This
    // assertion pins that call landed on the real element — no
    // fabricated click handler in the test.
    const { args } = buildAdapterArgs(dom, packetButton);
    attachRuntimeInputAdapters(args);

    dispatchPointerdown(dom, packetButton, 100, 100);
    dispatchPointercancel(dom, packetButton, 100, 100);

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animateSpy.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];
    // Full-motion path pinned by the writer's frozen constants.
    expect(keyframes).toHaveLength(4);
    expect(keyframes[1].transform).toBe(
      `translateX(${-PACKET_CANCEL_FAILURE_STING.shakePx}px)`,
    );
    expect(keyframes[2].transform).toBe(
      `translateX(${PACKET_CANCEL_FAILURE_STING.shakePx}px)`,
    );
    expect(options.duration).toBe(PACKET_CANCEL_FAILURE_STING.shakeMs);
    expect(options.easing).toBe(PACKET_CANCEL_FAILURE_STING.easing);
    expect(options.fill).toBe("none");
  });

  it("SERVED-PATH: a normal pointerup (tap, not cancel) does NOT fire the sting", () => {
    // Regression pin: the served `pointerup` handler feeds a
    // `kind: "tap"` gesture through the pure judge — a tap gesture
    // never classifies as `reason: "cancelled"` (the pure judge
    // returns that reason only for `kind: "cancel"`), so the writer
    // stays silent on every healthy release. This is what keeps a
    // normal preserve-tap from double-triggering the failure sting.
    const { args } = buildAdapterArgs(dom, packetButton);
    attachRuntimeInputAdapters(args);

    dispatchPointerdown(dom, packetButton, 100, 100);
    dispatchPointerup(dom, packetButton, 100, 100);

    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("SERVED-PATH: a stray pointercancel with NO preceding pointerdown does not throw and does not play", () => {
    // Defensive pin on the served adapter's press-summary tracking:
    // without a matching `pointerdown` the dispatch helper short-
    // circuits (packetPressAtMs is null) and never calls the writer.
    const { args } = buildAdapterArgs(dom, packetButton);
    attachRuntimeInputAdapters(args);

    expect(() => dispatchPointercancel(dom, packetButton, 100, 100)).not.toThrow();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("SERVED-PATH: after a pointercancel resets state, a subsequent stray cancel does not double-fire", () => {
    // The served adapter nulls the press summary after every
    // release / cancel so a subsequent event without a fresh press
    // does not re-fire the sting. Pin that reset.
    const { args } = buildAdapterArgs(dom, packetButton);
    attachRuntimeInputAdapters(args);

    dispatchPointerdown(dom, packetButton, 100, 100);
    dispatchPointercancel(dom, packetButton, 100, 100);
    expect(animateSpy).toHaveBeenCalledTimes(1);

    dispatchPointercancel(dom, packetButton, 100, 100);
    // Still exactly one — the reset held.
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  // The pure writer's own contract pins — kept here so the writer
  // module and its served wire live in ONE consumer test file. These
  // exercise the writer directly (not through the served adapter),
  // because the reduced-motion / null-safety branches can't be
  // driven cleanly through a `pointercancel` event.

  it("WRITER: swaps to a filter-only flash under reduced motion (no positional shake)", () => {
    playPacketCancelFailureSting(packetButton, { reducedMotion: true });

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animateSpy.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];
    expect(keyframes).toHaveLength(3);
    for (const frame of keyframes) {
      expect(frame).not.toHaveProperty("transform");
      expect(frame.filter).toEqual(expect.any(String));
    }
    expect(options.duration).toBe(PACKET_CANCEL_FAILURE_STING.flashMs);
  });

  it("WRITER: is a no-op on a null element — MUST NEVER throw", () => {
    expect(() => playPacketCancelFailureSting(null)).not.toThrow();
    expect(() => playPacketCancelFailureSting(undefined)).not.toThrow();
    expect(playPacketCancelFailureSting(null)).toBe(false);
    expect(playPacketCancelFailureSting(undefined)).toBe(false);
  });

  it("WRITER: returns false and does not throw when the runtime lacks Element.animate", () => {
    const bare = dom.window.document.createElement("button");
    expect(() => playPacketCancelFailureSting(bare as unknown as HTMLElement))
      .not.toThrow();
    expect(playPacketCancelFailureSting(bare as unknown as HTMLElement)).toBe(
      false,
    );
  });

  it("WRITER: returns true after a successful animate() call", () => {
    expect(playPacketCancelFailureSting(packetButton)).toBe(true);
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });
});
