import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  AFTERSIGN_DELIVERY_COMPLETE_COPY,
  aftersignDeliveryCompleteLine,
} from "./aftersignDeliveryCompleteCopy.js";
// @ts-ignore -- plain JS module without declarations.
import { resolveIoDialogue } from "../../../../aftersign/src/ioDialogueResolver.js";

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
// #2783: Io's non-terminal beat routing (incl. packet-delivered) moved
// out of main.js into this resolver; main.js injects the copy lookups.
const ioDialogueResolverSource = readFileSync(
  resolve(here, "../../../../aftersign/src/ioDialogueResolver.js"),
  "utf8",
);

const RED_TAG_LINE =
  "Done. Red tag delivered to Saint Orra. She files it under your name. Come back, and she will know the courier who carried it.";
const BLUE_PACKET_LINE =
  "Done. Blue packet delivered. I set its mark beside your name. When you return, I will know the courier who carried it.";

// PR #2558 review F1/F2: the packet-delivered beat renders the
// delivery-complete line keyed only by delivery id, on both the sealed
// and the opened path. Any seal-state claim in this copy is false for
// one of those players.
const SEAL_STATE_CLAIM = /\bseal(ed)?\b|\bopened\b|\bclosed\b|\bunopened\b|\blooked inside\b/i;

describe("aftersignDeliveryCompleteLine (frozen copy)", () => {
  it("returns the red-tag line for a red-tag delivery — the Saint Orra handoff never falls through to blue-packet copy", () => {
    // #2242's visible bug: delivery-complete after a red-tag second
    // packet was reading the blue line. Assert the exact red-tag
    // string AND that the blue-packet language is absent — a typo in
    // the frozen module that drops "Saint Orra" or re-introduces
    // "Blue packet delivered" reds this test.
    const line = aftersignDeliveryCompleteLine("red-tag");
    expect(line).toBe(RED_TAG_LINE);
    expect(line).toContain("Saint Orra");
    expect(line).toContain("under your name");
    expect(line).not.toContain("Blue packet delivered");
  });

  it("returns the blue-packet line for a blue-packet delivery", () => {
    const line = aftersignDeliveryCompleteLine("blue-packet");
    expect(line).toBe(BLUE_PACKET_LINE);
    expect(line).toContain("Blue packet delivered");
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
    // #2783: the packet-delivered branch moved into
    // aftersign/src/ioDialogueResolver.js. main.js must inject the frozen
    // lookup and the live delivery id; the resolver must call it.
    expect(servedRendererSource).toContain(
      'import { resolveIoDialogue } from "./src/ioDialogueResolver.js";',
    );
    expect(servedRendererSource).toContain(
      "deliveryCompleteLine: aftersignDeliveryCompleteLine,",
    );
    expect(servedRendererSource).toContain("deliveryId: state.delivery.id,");
    expect(ioDialogueResolverSource).toContain(
      "return deliveryCompleteLine(deliveryId);",
    );
    // The two literals that used to live in the ternary must be
    // sourced only from the frozen module now. If either reappears
    // in main.js or the resolver (copy-paste regression), red the test.
    expect(servedRendererSource).not.toContain(RED_TAG_LINE);
    expect(servedRendererSource).not.toContain(BLUE_PACKET_LINE);
    expect(ioDialogueResolverSource).not.toContain(RED_TAG_LINE);
    expect(ioDialogueResolverSource).not.toContain(BLUE_PACKET_LINE);
  });

  it("never claims a seal state, because the packet-delivered beat shows it on both sealed and opened paths (PR #2558 F1)", () => {
    // Pin the resolver shape that makes this invariant necessary: the
    // packet-delivered branch falls through to the id-keyed line with
    // no `packet.sealed` check (#2783: branch lives in the resolver).
    const branchStart = ioDialogueResolverSource.indexOf('if (beat === "packet-delivered") {');
    expect(branchStart).toBeGreaterThan(-1);
    const branchEnd = ioDialogueResolverSource.indexOf(
      "return deliveryCompleteLine(deliveryId);",
      branchStart,
    );
    expect(branchEnd).toBeGreaterThan(branchStart);
    const branch = ioDialogueResolverSource.slice(branchStart, branchEnd);
    expect(branch).not.toContain("packet.sealed");

    // Behavioral check with the REAL frozen copy (not a stub): the
    // resolver returns the same id-keyed line for sealed and opened runs.
    for (const deliveryId of ["red-tag", "blue-packet"]) {
      const lines = [true, false].map((sealed) =>
        resolveIoDialogue({
          beat: "packet-delivered",
          packet: { sealed },
          player: { routeRisk: null },
          npcs: { io: { memory: [] } },
          deliveryId,
          returningBootLine: null,
          returningBootBeat: null,
          routeOutcomeLine: () => null,
          deliveryCompleteLine: aftersignDeliveryCompleteLine,
        }),
      );
      expect(lines[0]).toBe(aftersignDeliveryCompleteLine(deliveryId));
      expect(lines[1]).toBe(lines[0]);
    }
    expect(
      resolveIoDialogue({
        beat: "packet-delivered",
        packet: { sealed: false },
        player: { routeRisk: null },
        npcs: { io: { memory: [] } },
        deliveryId: "red-tag",
        returningBootLine: null,
        returningBootBeat: null,
        routeOutcomeLine: () => null,
        deliveryCompleteLine: aftersignDeliveryCompleteLine,
      }),
    ).toBe(RED_TAG_LINE);

    // Since the line is seal-blind, every entry (and the fallback) must
    // read true for a player who opened the packet and one who did not.
    for (const [id, line] of Object.entries(AFTERSIGN_DELIVERY_COMPLETE_COPY)) {
      expect(line, `delivery-complete copy for ${id}`).not.toMatch(SEAL_STATE_CLAIM);
    }
    expect(aftersignDeliveryCompleteLine(undefined)).not.toMatch(SEAL_STATE_CLAIM);
  });
});
