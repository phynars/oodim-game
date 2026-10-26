// #2511 — consumer test for Io's skipped-route recognition writer and
// the durable-memory gate main.js uses to select it.

import { beforeEach, describe, expect, it } from "vitest";

import {
  IO_ROUTE_RETURN_LINE_DATA_ATTR,
  IO_ROUTE_RETURN_LINE_ID,
  stampIoRouteReturnLine,
} from "./ioRouteReturnRender.js";
import { getAftersignIoRouteReturnLine } from "../../apps/web/src/aftersign/ioFirstSceneDialogue.ts";
import {
  buildPacketOutcomeMemoryFact,
  buildSecondActionMemoryFact,
  rememberedSkippedRoute,
  SECOND_ACTION,
} from "./memoryFacts.js";

const SKIPPED_TEXT =
  "You skipped my route. Instinct carried you once; the next stair will remember you guessed.";

function mountLineFixture() {
  document.body.innerHTML = `
    <main>
      <p id="speaker"></p>
      <p id="line">I remember you: blue seal, unbroken.</p>
      <div id="afterLine"></div>
    </main>
  `;
}

describe("stampIoRouteReturnLine", () => {
  beforeEach(mountLineFixture);

  it("stamps the shipped skippedReturn copy as #line's next sibling", () => {
    const el = stampIoRouteReturnLine(document, getAftersignIoRouteReturnLine(false));
    expect(el).not.toBeNull();
    expect(el.id).toBe(IO_ROUTE_RETURN_LINE_ID);
    expect(el.textContent).toBe(SKIPPED_TEXT);
    expect(el.getAttribute(IO_ROUTE_RETURN_LINE_DATA_ATTR)).toBe("skippedReturn");
    expect(document.getElementById("line").nextElementSibling).toBe(el);
  });

  it("does not modify #line textContent", () => {
    stampIoRouteReturnLine(document, getAftersignIoRouteReturnLine(false));
    expect(document.getElementById("line").textContent).toBe(
      "I remember you: blue seal, unbroken.",
    );
  });

  it("is idempotent and removes the paragraph on null", () => {
    stampIoRouteReturnLine(document, getAftersignIoRouteReturnLine(false));
    stampIoRouteReturnLine(document, getAftersignIoRouteReturnLine(false));
    expect(document.querySelectorAll(`#${IO_ROUTE_RETURN_LINE_ID}`)).toHaveLength(1);
    stampIoRouteReturnLine(document, null);
    expect(document.getElementById(IO_ROUTE_RETURN_LINE_ID)).toBeNull();
  });
});

describe("rememberedSkippedRoute", () => {
  const outcome = buildPacketOutcomeMemoryFact({ outcome: "sealed", sessionId: "s1" });

  it("is true only for an explicit skipped route-attention fact", () => {
    const skipped = buildSecondActionMemoryFact({
      secondAction: SECOND_ACTION.SKIPPED,
      sessionId: "s1",
    });
    expect(rememberedSkippedRoute([outcome, skipped])).toBe(true);
  });

  it("is false when the route was done", () => {
    const done = buildSecondActionMemoryFact({
      secondAction: SECOND_ACTION.DONE,
      sessionId: "s1",
    });
    expect(rememberedSkippedRoute([outcome, done])).toBe(false);
  });

  it("is false when no route-attention fact exists (#2437 no-tap branch)", () => {
    expect(rememberedSkippedRoute([outcome])).toBe(false);
    expect(rememberedSkippedRoute(undefined)).toBe(false);
  });
});
