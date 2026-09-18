import { describe, expect, it, vi } from "vitest";
import {
  IO_RETURN_LINE_FEEDBACK,
  playIoReturnLineFeedback,
} from "./ioReturnLineFeedback.js";

// Contract test for the return-line feel writer.
//
// The module ships the animate() envelope for Io's returning-session
// sibling paragraph (`#ioReturnLine`) — a small rise + fade that plays
// once per outcome and skips a same-outcome replay. This spec pins:
//   - the animate() keyframe list (rise from `risePx` at opacity 0,
//     land at translate3d(0,0,0) with an offset 0.72 hold, settle at
//     translate3d(0,0,0));
//   - the animate() options (`duration`, `easing`, `fill: "both"`);
//   - the memoisation via the `data-io-return-feedback` DOM stamp;
//   - the reduced-motion / no-`animate` fallback: still stamp, still
//     memoise, but skip the animation.
//
// Constants are read from `IO_RETURN_LINE_FEEDBACK` so the test tracks
// timing tweaks in the module without a matching edit here — if the
// SHAPE of the call changes (keyframe count, option keys), that IS a
// contract break and this test will catch it.

function feedbackElement() {
  const attributes = new Map();
  return {
    animate: vi.fn(),
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
  };
}

describe("playIoReturnLineFeedback", () => {
  it("plays once per remembered outcome and replays only when it changes", () => {
    const element = feedbackElement();

    expect(playIoReturnLineFeedback(element, "sealed")).toBe(true);
    expect(element.getAttribute("data-io-return-feedback")).toBe("sealed");
    expect(element.animate).toHaveBeenCalledTimes(1);
    expect(element.animate).toHaveBeenLastCalledWith(
      [
        {
          opacity: 0,
          transform: `translate3d(0, ${IO_RETURN_LINE_FEEDBACK.risePx}px, 0)`,
        },
        { opacity: 1, transform: "translate3d(0, 0, 0)", offset: 0.72 },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: IO_RETURN_LINE_FEEDBACK.durationMs,
        easing: IO_RETURN_LINE_FEEDBACK.easing,
        fill: "both",
      },
    );

    expect(playIoReturnLineFeedback(element, "sealed")).toBe(false);
    expect(element.animate).toHaveBeenCalledTimes(1);

    expect(playIoReturnLineFeedback(element, "opened")).toBe(true);
    expect(element.getAttribute("data-io-return-feedback")).toBe("opened");
    expect(element.animate).toHaveBeenCalledTimes(2);
  });

  it("stamps the outcome when the browser cannot animate", () => {
    const element = feedbackElement();
    delete element.animate;

    expect(playIoReturnLineFeedback(element, "sealed")).toBe(true);
    expect(playIoReturnLineFeedback(element, "sealed")).toBe(false);
    expect(element.getAttribute("data-io-return-feedback")).toBe("sealed");
  });
});
