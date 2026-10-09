import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  AFTERSIGN_DELIVERY_COMPLETE_COPY,
  aftersignDeliveryCompleteLine,
} from "./aftersignDeliveryCompleteCopy.js";

// Re-review on PR #2247 (Soren Vask):
//   1. The first draft resolved main.js via `new URL(..., import.meta.url)`
//      at module top-level. The `test:unit:aftersign` vitest config uses
//      `environment: "jsdom"`, where `import.meta.url` is an `http:` URL
//      (not `file:`) and `readFileSync` throws `ERR_INVALID_URL_SCHEME`
//      at import time — reds the whole file before any `it` runs.
//      Fix: `fileURLToPath(import.meta.url)` + `dirname` + `resolve`,
//      which is the shape every sibling main.js-reader uses
//      (`ioNextJobDurability.test.ts`).
//   2. The first draft only grep'd `main.js` text; it never *called*
//      `aftersignDeliveryCompleteLine`. A string typo in the frozen
//      module or a flipped fallback would ship green. Fix: invoke the
//      function directly and pin each delivery-id → copy mapping, plus
//      the non-string / unknown-id fallbacks. The main.js wire-up grep
//      stays as ONE assertion so the extraction can't quietly regress
//      back to inline literals (that's the AC "no hardcoded literals
//      in main.js" from #2242).

const here = dirname(fileURLToPath(import.meta.url));
const servedRendererSource = readFileSync(
  resolve(here, "../../../../aftersign/main.js"),
  "utf8",
);

const RED_TAG_LINE =
  "Done. Red tag delivered to Saint Orra. The pharmacy sign kept your name; the debt is yours to answer.";
const BLUE_PACKET_LINE =
  "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.";

describe("aftersignDeliveryCompleteLine (frozen copy)", () => {
  it("returns the red-tag line for a red-tag delivery — the Saint Orra handoff never falls through to blue-route copy", () => {
    // #2242's visible bug: delivery-complete after a red-tag second
    // packet was reading "Blue route…". Assert the exact red-tag
    // string AND that the blue-route language is absent — a typo in
    // the frozen module that drops "Saint Orra" or re-introduces
    // "Blue route" reds this test.
    const line = aftersignDeliveryCompleteLine("red-tag");
    expect(line).toBe(RED_TAG_LINE);
    expect(line).toContain("Saint Orra");
    expect(line).toContain("pharmacy sign");
    expect(line).not.toContain("Blue route");
  });

  it("returns the blue-packet line for a blue-packet delivery", () => {
    const line = aftersignDeliveryCompleteLine("blue-packet");
    expect(line).toBe(BLUE_PACKET_LINE);
    expect(line).toContain("Blue route");
    expect(line).not.toContain("Red tag");
  });

  it("falls back to the blue-packet line for unknown delivery ids (never surfaces a missing token or empty string)", () => {
    // Future packet ids must not blank the delivery-complete beat.
    // The established behavior is to keep the blue-packet line as
    // the safe default — a visible empty beat would read as a bug.
    expect(aftersignDeliveryCompleteLine("green-signal")).toBe(BLUE_PACKET_LINE);
    expect(aftersignDeliveryCompleteLine("")).toBe(BLUE_PACKET_LINE);
  });

  it("falls back to the blue-packet line for non-string delivery ids (never throws)", () => {
    // Defensive: `state.delivery.id` is typed string in the renderer
    // path, but a mid-flight state shape change or a reload-restore
    // bug could land `undefined`/`null`/a number here. The frozen
    // module must not throw — the beat still has to render.
    expect(aftersignDeliveryCompleteLine(undefined)).toBe(BLUE_PACKET_LINE);
    expect(aftersignDeliveryCompleteLine(null)).toBe(BLUE_PACKET_LINE);
    expect(aftersignDeliveryCompleteLine(42)).toBe(BLUE_PACKET_LINE);
    expect(() => aftersignDeliveryCompleteLine(undefined)).not.toThrow();
  });

  it("exports a frozen copy table so neither id → line entry can be mutated at runtime", () => {
    // #2242 AC: "Delivery copy reflects red-tag strings sourced from
    // frozen copy modules." A non-frozen table lets a late consumer
    // reassign `AFTERSIGN_DELIVERY_COMPLETE_COPY["red-tag"]` and
    // re-introduce the exact bug the frozen module was built to
    // prevent.
    expect(Object.isFrozen(AFTERSIGN_DELIVERY_COMPLETE_COPY)).toBe(true);
    expect(AFTERSIGN_DELIVERY_COMPLETE_COPY["red-tag"]).toBe(RED_TAG_LINE);
    expect(AFTERSIGN_DELIVERY_COMPLETE_COPY["blue-packet"]).toBe(BLUE_PACKET_LINE);
  });
});

describe("served delivery-complete wiring in aftersign/main.js", () => {
  it("imports the frozen copy module and resolves the delivery id through it, with the two inline literals removed", () => {
    // #2242 AC: "No hardcoded literals in main.js." Pin the import
    // + call site AND assert the old inline ternary strings no
    // longer live in main.js — a future author who reverts the
    // extraction reds this test, not just a review.
    expect(servedRendererSource).toContain(
      'import { aftersignDeliveryCompleteLine } from "../apps/web/src/aftersign/aftersignDeliveryCompleteCopy.js";',
    );
    expect(servedRendererSource).toContain(
      "return aftersignDeliveryCompleteLine(state.delivery.id);",
    );
    // The two literals that used to live in the ternary must be
    // sourced only from the frozen module now. If either reappears
    // in main.js (copy-paste regression), red the test.
    expect(servedRendererSource).not.toContain(
      "Done. Red tag delivered to Saint Orra. The pharmacy sign kept your name; the debt is yours to answer.",
    );
    expect(servedRendererSource).not.toContain(
      "Done. Blue route, clean handoff. Come back after the rain; I will know the mark was yours.",
    );
  });
});
