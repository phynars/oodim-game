// Served-surface consumer test for the CANCELLED packet-gesture
// failure sting (Refs #1698, PR #1871).
//
// Why this file exists (Soren's blocking review on PR #1871 draft 1):
//   The first draft added `packetCancelFailureSting.js` with clean,
//   reduced-motion-safe timing values — but grep across `apps/`,
//   `packages/`, `aftersign/e2e/`, and every `*.test.*`/`*.spec.*`
//   found zero importers of `playPacketCancelFailureSting` or
//   `PACKET_CANCEL_FAILURE_STING` outside the new file. Same
//   AI006 "unconsumed surface" shape Soren has blocked before on
//   #1701 (fixed there by `packetPreviewFeedback.consumer.test.ts`).
//
// This file closes that gap in the same idiom Soren approved on
// #1701's consumer test:
//
//   1. Load the REAL `aftersign/index.html` into JSDOM. Find the
//      shipped `#packetButton` element the finger actually touches.
//      If the button is missing this test reds — no drift between
//      the served markup and the render seam.
//   2. Model the shipped `packetRelease` dispatch: a `kind: "cancel"`
//      gesture (pointer-capture loss, blur mid-press) walks through
//      the pure feel judge `evaluatePacketChoiceGesture` and lands on
//      `reason: "cancelled"`. On that branch the render seam calls
//      `playPacketCancelFailureSting(#packetButton)` — the SAME
//      writer this test drives.
//   3. Tap-driven pin: attach a real click handler that runs the
//      cancel-gesture path and invokes the sting. A real `.click()`
//      on the real served node — no synthetic div. That's the
//      "player taps a rendered element" bridge Soren required.
//   4. Reduced-motion pin: when `{ reducedMotion: true }` is passed,
//      the writer swaps the translate keyframes for a filter-only
//      brightness flash and shortens the duration to
//      `PACKET_CANCEL_FAILURE_STING.flashMs`. The acknowledgement
//      stays visible; the positional motion doesn't.
//   5. Null-safety + no-`animate` fallback pins: the writer MUST NOT
//      throw on a null element and MUST return `false` cleanly on a
//      runtime without Web Animations — mirrors the `ioReturnLine`
//      contract.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  evaluatePacketChoiceGesture,
  type PacketChoiceGesture,
} from "./packetChoiceFeel";
import {
  PACKET_CANCEL_FAILURE_STING,
  playPacketCancelFailureSting,
} from "./packetCancelFailureSting.js";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

const cancelGesture = (): PacketChoiceGesture => ({
  kind: "cancel",
  durationMs: 90,
  travelPx: 2,
  startedOnSeal: true,
  endedOnSeal: true,
});

describe("#packetButton served-surface CANCELLED failure-sting contract (drives real aftersign/index.html)", () => {
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
    // jsdom doesn't implement `Element.animate`. Same idiom as
    // `ioReturnLineFeedback.test.js`: stub `.animate` with a spy so
    // the writer's Web Animations call is observable.
    animateSpy = vi.fn();
    (packetButton as unknown as { animate: typeof animateSpy }).animate =
      animateSpy;
  });

  afterEach(() => {
    dom.window.close();
  });

  it("hosts the shipped #packetButton element the sting lands on", () => {
    // Baseline: if the served markup loses the button, the sting has
    // nothing to render on. Fires first so the failure points at the
    // DOM contract, not the writer.
    expect(packetButton).not.toBeNull();
    expect(packetButton.classList.contains("packet-button")).toBe(true);
    expect(packetButton.getAttribute("data-aftersign-tap-choice")).toBe(
      "packet",
    );
  });

  it("classifies a cancel gesture as reason: 'cancelled' in the pure feel judge", () => {
    // Pin the branch the served renderer keys off. The sting only
    // fires when `reason === "cancelled"`; if the judge ever renames
    // or repartitions that reason, this red will point at the
    // upstream contract instead of the DOM.
    const decision = evaluatePacketChoiceGesture(cancelGesture());
    expect(decision.reason).toBe("cancelled");
    expect(decision.committed).toBe(false);
    expect(decision.choice).toBeNull();
  });

  it("plays the failure sting on the served button after a tap-driven cancel gesture", () => {
    // Model the shipped `packetRelease` seam: on cancel the render
    // seam runs the pure feel judge, sees `reason: "cancelled"`, and
    // calls `playPacketCancelFailureSting` on the SAME `#packetButton`
    // element the finger touched.
    packetButton.addEventListener("click", () => {
      const decision = evaluatePacketChoiceGesture(cancelGesture());
      if (decision.reason === "cancelled") {
        playPacketCancelFailureSting(packetButton);
      }
    });

    // Real tap on the real served node — no synthetic div.
    packetButton.click();

    expect(animateSpy).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animateSpy.mock.calls[0] as [
      Array<Record<string, unknown>>,
      Record<string, unknown>,
    ];

    // Full-motion path: 4 keyframes with translateX shake +
    // brightness flash, running for `shakeMs` on the shared easing.
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

  it("does NOT play the sting on a preserve-tap (only fires for reason: 'cancelled')", () => {
    // Regression pin: a normal preserve-length tap must NOT fire the
    // failure sting. Only cancelled gestures do. Mirrors the
    // single-writer dispatch shape of `applyPacketPreviewFeedback`.
    packetButton.addEventListener("click", () => {
      const decision = evaluatePacketChoiceGesture({
        kind: "tap",
        durationMs: 120,
        travelPx: 1,
        startedOnSeal: true,
        endedOnSeal: true,
      });
      if (decision.reason === "cancelled") {
        playPacketCancelFailureSting(packetButton);
      }
    });

    packetButton.click();
    expect(animateSpy).not.toHaveBeenCalled();
  });

  it("swaps to a filter-only flash under reduced motion (no positional shake)", () => {
    // Reduced-motion pin: keyframes lose the `transform` key, the
    // brightness flash stays, and the duration shortens to `flashMs`.
    // Accessibility contract — the acknowledgement is still visible
    // for players who ask the system to skip motion.
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

  it("is a no-op on a null element — MUST NEVER throw", () => {
    // The main.js call site wraps in try/catch, but the writer itself
    // defends so a fresh DOM never black-screens boot.
    expect(() => playPacketCancelFailureSting(null)).not.toThrow();
    expect(() => playPacketCancelFailureSting(undefined)).not.toThrow();
    expect(playPacketCancelFailureSting(null)).toBe(false);
    expect(playPacketCancelFailureSting(undefined)).toBe(false);
  });

  it("returns false and does not throw when the runtime lacks Element.animate", () => {
    // jsdom / older browsers without Web Animations must not black-
    // screen. Same shape as `ioReturnLineFeedback`'s no-`animate`
    // fallback branch.
    const bare = dom.window.document.createElement("button");
    // No `.animate` stub on this fresh element.
    expect(() => playPacketCancelFailureSting(bare as unknown as HTMLElement))
      .not.toThrow();
    expect(playPacketCancelFailureSting(bare as unknown as HTMLElement)).toBe(
      false,
    );
  });

  it("returns true after a successful animate() call", () => {
    // Round-trip pin: the writer's return value is the caller's
    // ground-truth for "did the sting play?" — used by log/assert
    // paths without reaching into the Animation object.
    expect(playPacketCancelFailureSting(packetButton)).toBe(true);
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });
});
