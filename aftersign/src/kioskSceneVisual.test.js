import { describe, expect, it, beforeEach } from "vitest";
import { applyKioskSceneVisual } from "./kioskSceneVisual.js";

// Contract test for the kiosk scene visual writer.
//
// Wired into the served page via `ioReturnLineFeedback.js` (which
// main.js's `renderText()` already invokes on the real
// `#ioReturnLine` at the recognition beat). This spec pins:
//   - the `data-aftersign-kiosk-visual="mounted"` played-not-driven
//     stamp on the surface (the marker an e2e / servedSurface pin
//     can poll to confirm the wire actually landed);
//   - the `.aftersign-kiosk-scene` class on the surface;
//   - a single shared stylesheet in `<head>` (repeated `renderText()`
//     re-arms every frame must NOT append duplicate `<style>` nodes);
//   - the idempotent early return once the dataset marker is set.
//
// The unit `playIoReturnLineFeedback` spec passes a bare object (no
// `parentElement`) — the visual writer's `!(surface && classList.add)`
// guard is what keeps that path safe, so this file also covers the
// no-op branch.

function panelSurface() {
  document.body.innerHTML = "";
  const panel = document.createElement("div");
  const line = document.createElement("p");
  line.id = "line";
  const returnLine = document.createElement("p");
  returnLine.id = "ioReturnLine";
  panel.append(line, returnLine);
  document.body.append(panel);
  return { panel, returnLine };
}

describe("applyKioskSceneVisual", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("stamps the played-not-driven marker + scoped class on the surface", () => {
    const { panel } = panelSurface();

    expect(applyKioskSceneVisual(panel)).toBe(true);
    expect(panel.getAttribute("data-aftersign-kiosk-visual")).toBe("mounted");
    expect(panel.classList.contains("aftersign-kiosk-scene")).toBe(true);

    const styles = document.head.querySelectorAll(
      "style[data-aftersign-kiosk-visual]",
    );
    expect(styles).toHaveLength(1);
    const cssText = styles[0].textContent ?? "";
    expect(cssText).toContain(".aftersign-kiosk-scene #ioReturnLine");
    expect(cssText).toContain("prefers-reduced-motion");
  });

  it("is idempotent across repeated renderText() re-arms", () => {
    const { panel } = panelSurface();
    applyKioskSceneVisual(panel);

    // Second call on the same surface must not re-stamp the class list
    // or append a second stylesheet — renderText() runs every frame.
    expect(applyKioskSceneVisual(panel)).toBe(false);
    expect(
      document.head.querySelectorAll("style[data-aftersign-kiosk-visual]"),
    ).toHaveLength(1);
    expect(
      panel.classList.value.split(/\s+/).filter((c) => c === "aftersign-kiosk-scene"),
    ).toHaveLength(1);
  });

  it("shares one stylesheet across multiple mounted surfaces", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);

    expect(applyKioskSceneVisual(first)).toBe(true);
    expect(applyKioskSceneVisual(second)).toBe(true);
    expect(
      document.head.querySelectorAll("style[data-aftersign-kiosk-visual]"),
    ).toHaveLength(1);
  });

  it("is a no-op on a disconnected surface (isConnected === false)", () => {
    // PR #1867 iterate 5: renderText() runs every frame at the
    // recognition beat; during a `.panel` swap-out the parentElement
    // we're handed can be an orphan (owner doc set, isConnected
    // false). We short-circuit rather than thrashing a detached
    // node — the next frame's re-arm hits a connected surface.
    const orphan = document.createElement("div");
    // Not appended to document.body → isConnected === false.
    expect(orphan.isConnected).toBe(false);
    expect(applyKioskSceneVisual(orphan)).toBe(false);
    expect(orphan.getAttribute("data-aftersign-kiosk-visual")).toBeNull();
    expect(orphan.classList.contains("aftersign-kiosk-scene")).toBe(false);
    expect(
      document.head.querySelectorAll("style[data-aftersign-kiosk-visual]"),
    ).toHaveLength(0);
  });

  it("is a no-op on non-element input (harness fake, null, undefined)", () => {
    expect(applyKioskSceneVisual(null)).toBe(false);
    expect(applyKioskSceneVisual(undefined)).toBe(false);
    expect(applyKioskSceneVisual({})).toBe(false);
    // Fake used by the sibling ioReturnLineFeedback unit test —
    // getAttribute/setAttribute only, no classList.
    const fake = {
      getAttribute: () => null,
      setAttribute: () => {},
    };
    expect(applyKioskSceneVisual(fake)).toBe(false);
    // No stylesheet leaked to the doc from the no-op path.
    expect(
      document.head.querySelectorAll("style[data-aftersign-kiosk-visual]"),
    ).toHaveLength(0);
  });
});
