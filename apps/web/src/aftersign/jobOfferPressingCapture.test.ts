// PR #1911 re-review (Soren Vask): the first draft of pointer-capture
// landed on `renderAftersignJobOfferActionButton`, which nothing on the
// served page calls. The real owner of the offered-job press envelope
// is `aftersign/jobOfferPressing.js` — loaded by `<script>` from
// `aftersign/index.html:1593` and attached to every rendered
// `button[data-aftersign-job-take]`. This test drives the SHIPPED
// owner against a jsdom button, stubs the Pointer Capture API (jsdom
// lacks it), and pins that:
//
//   1. `pointerdown` calls `setPointerCapture(pointerId)` — so a
//      fingertip drift during the 96ms hold still routes the
//      subsequent `pointerup` and `click` back to THIS button.
//   2. `pointerup` calls `releasePointerCapture(pointerId)` — clean
//      release on the natural terminator.
//   3. `pointercancel` calls `releasePointerCapture(pointerId)` — the
//      OS-cancelled path releases just like pointerup.
//   4. `armPressing` still flips `data-aftersign-job-take` to
//      `"pressing"` (the capture wire must not have broken the
//      visual marker the CSS transition and the e2e press-juice
//      spec already depend on).
//
// Runs in the aftersign vitest blocking lane (see `vitest.config.ts`)
// so PR CI enforces the wire.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachJobOfferPressing } from "../../../../aftersign/jobOfferPressing.js";

function mountJobOfferButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("data-aftersign-job-take", "ready");
  document.body.append(button);
  return button;
}

function stubPointerCaptureApi(button: HTMLButtonElement): {
  captured: Set<number>;
  setSpy: ReturnType<typeof vi.fn>;
  hasSpy: ReturnType<typeof vi.fn>;
  releaseSpy: ReturnType<typeof vi.fn>;
} {
  const captured = new Set<number>();
  const setSpy = vi.fn((id: number) => {
    captured.add(id);
  });
  const hasSpy = vi.fn((id: number) => captured.has(id));
  const releaseSpy = vi.fn((id: number) => {
    captured.delete(id);
  });
  button.setPointerCapture = setSpy as unknown as HTMLButtonElement["setPointerCapture"];
  button.hasPointerCapture = hasSpy as unknown as HTMLButtonElement["hasPointerCapture"];
  button.releasePointerCapture =
    releaseSpy as unknown as HTMLButtonElement["releasePointerCapture"];
  return { captured, setSpy, hasSpy, releaseSpy };
}

function firePointerEvent(
  button: HTMLButtonElement,
  type: "pointerdown" | "pointerup" | "pointercancel" | "lostpointercapture",
  pointerId: number,
): void {
  const event = new Event(type) as Event & { pointerId: number };
  event.pointerId = pointerId;
  button.dispatchEvent(event);
}

describe("aftersign/jobOfferPressing.js — pointer capture (shipped owner)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("pointerdown captures the pointer AND stamps data-aftersign-job-take='pressing'", () => {
    const button = mountJobOfferButton();
    const { setSpy, captured } = stubPointerCaptureApi(button);

    attachJobOfferPressing(button);
    firePointerEvent(button, "pointerdown", 7);

    // Capture actually happened on the shipped surface.
    expect(setSpy).toHaveBeenCalledWith(7);
    expect(captured.has(7)).toBe(true);
    // The visual marker (already covered by the e2e press-juice spec)
    // must still flip — pointer-capture is an addition, not a swap.
    expect(button.getAttribute("data-aftersign-job-take")).toBe("pressing");
  });

  it("pointerup releases the captured pointer", () => {
    const button = mountJobOfferButton();
    const { releaseSpy, captured } = stubPointerCaptureApi(button);

    attachJobOfferPressing(button);
    firePointerEvent(button, "pointerdown", 11);
    expect(captured.has(11)).toBe(true);

    firePointerEvent(button, "pointerup", 11);
    expect(releaseSpy).toHaveBeenCalledWith(11);
    expect(captured.has(11)).toBe(false);
  });

  it("pointercancel releases the captured pointer (OS-cancelled path)", () => {
    const button = mountJobOfferButton();
    const { releaseSpy, captured } = stubPointerCaptureApi(button);

    attachJobOfferPressing(button);
    firePointerEvent(button, "pointerdown", 21);
    expect(captured.has(21)).toBe(true);

    firePointerEvent(button, "pointercancel", 21);
    expect(releaseSpy).toHaveBeenCalledWith(21);
    expect(captured.has(21)).toBe(false);
  });

  it("release calls are a no-op when hasPointerCapture returns false", () => {
    const button = mountJobOfferButton();
    const { releaseSpy } = stubPointerCaptureApi(button);
    // Force hasPointerCapture to say "not captured" so the release
    // guard should short-circuit.
    button.hasPointerCapture = (() => false) as unknown as HTMLButtonElement["hasPointerCapture"];

    attachJobOfferPressing(button);
    firePointerEvent(button, "pointerup", 3);

    // No pointerdown fired first — release must not be called blindly.
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it("attachJobOfferPressing is idempotent (WeakSet guard survives capture wiring)", () => {
    const button = mountJobOfferButton();
    const { setSpy } = stubPointerCaptureApi(button);

    attachJobOfferPressing(button);
    attachJobOfferPressing(button);
    attachJobOfferPressing(button);

    firePointerEvent(button, "pointerdown", 99);
    // Exactly one pointerdown listener means exactly one setPointerCapture.
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("survives environments without the Pointer Capture API (defensive `?.` guards)", () => {
    // Some browsers / test environments still lack Pointer Capture. The
    // shipped owner must NOT throw when setPointerCapture is undefined.
    const button = mountJobOfferButton();
    // Intentionally do NOT stub any of the capture methods — they stay
    // undefined, as jsdom leaves them.

    attachJobOfferPressing(button);
    expect(() => firePointerEvent(button, "pointerdown", 5)).not.toThrow();
    expect(() => firePointerEvent(button, "pointerup", 5)).not.toThrow();
    expect(() => firePointerEvent(button, "pointercancel", 5)).not.toThrow();

    // Visual marker still flips regardless of capture API presence.
    // (pointerdown → 'pressing'; after the FALLBACK_HOLD_MS timer, the
    // observer restores prior state — we're not asserting the timer
    // path here, just the down-side marker.)
    // The marker is set synchronously inside the pointerdown handler.
    // We refire to inspect the mid-hold state.
    button.setAttribute("data-aftersign-job-take", "ready");
    firePointerEvent(button, "pointerdown", 6);
    expect(button.getAttribute("data-aftersign-job-take")).toBe("pressing");
  });
});
