// Pure-lane coverage for `routeRiskLabelsForDelivery` — the resolver
// `aftersign/main.js` consults at the `packet-choice` beat to label the
// route-risk tray buttons.
//
// Why this test exists (Soren's REQUEST_CHANGES on PR #2253):
//   The first draft of #2245's wire-up routed label selection through
//   `chooseAftersignJobOfferCopy` using a `delivery-outcome` fact in
//   `npcs.io.memory`. On a red-tag delivery with no such fact (the
//   state a round-2 red-tag second-packet handoff hits BEFORE the
//   player makes any delivery), that selector returns FIRST_RUN —
//   so the buttons rendered the blue-packet labels on a red surface.
//
//   This test pins the regression at the pure-resolver layer:
//     1. Red-tag → labels sourced from
//        `AFTERSIGN_JOB_OFFER_COPY.trusted` (verbatim: "Long way —
//        past the kiosk" / "Behind the shuttered pharmacy").
//     2. Red-tag → NEVER returns the firstRun blue-packet literals,
//        regardless of memory state (the resolver doesn't even read
//        memory anymore; delivery identity alone is the signal).
//     3. Non red-tag → identical behavior to the backwards-compatible
//        `routeRiskActionLabel` default (firstRun labels, generic
//        fallback for unknown ids).
//
// Shape: pure .test.ts under vitest, no DOM, no harness. Pinned at the
// resolver layer so a future wire-up swap in main.js keeps the ground
// truth; the matching tap-driven e2e lives at
// `aftersign/e2e/red-tag-second-packet-round-2.spec.ts`.

import { describe, expect, it } from "vitest";

import { AFTERSIGN_JOB_OFFER_COPY } from "../../apps/web/src/aftersign/aftersignJobOfferCopy.js";
import { routeRiskActionLabel } from "../../apps/web/src/aftersign/routeRiskActionLabels.js";
import { routeRiskLabelsForDelivery } from "./redTagRouteOfferLabels.js";

describe("routeRiskLabelsForDelivery", () => {
  it("red-tag → returns a resolver bound to the TRUSTED offer row", () => {
    const resolver = routeRiskLabelsForDelivery("red-tag");
    expect(resolver("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );
    expect(resolver("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    // Explicit literal pins — if the authored copy drifts, this test
    // speaks the player-visible symptom from the #2253 regression report.
    expect(resolver("take-the-long-way")).toBe("Long way — past the kiosk");
    expect(resolver("take-the-shortcut")).toBe(
      "Behind the shuttered pharmacy",
    );
  });

  it("red-tag → NEVER returns the firstRun blue-packet labels (#2253 regression)", () => {
    const resolver = routeRiskLabelsForDelivery("red-tag");
    // The previous iteration of this module took an `offerCopy`
    // argument derived from `npcs.io.memory`; when memory was empty,
    // `chooseAftersignJobOfferCopy({})` returned FIRST_RUN and the
    // buttons rendered the blue-packet labels. The current resolver
    // ignores memory entirely for red-tag deliveries, so the
    // regression surface is closed by construction.
    expect(resolver("take-the-long-way")).not.toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel,
    );
    expect(resolver("take-the-shortcut")).not.toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.riskyRouteLabel,
    );
    expect(resolver("take-the-long-way")).not.toMatch(/Lit stair/);
    expect(resolver("take-the-shortcut")).not.toMatch(
      /Cut past the bell rope/,
    );
  });

  it("red-tag → the non-route actions keep their stable labels", () => {
    const resolver = routeRiskLabelsForDelivery("red-tag");
    expect(resolver("repair-the-loss")).toBe(
      "Repair the loss before you run",
    );
    expect(resolver("carry-a-fragile-packet")).toBe(
      "Carry the fragile packet",
    );
  });

  it("red-tag → unknown action ids fall back to the generic prompt (no raw ids leak)", () => {
    const resolver = routeRiskLabelsForDelivery("red-tag");
    expect(resolver("some-future-action-id")).toBe("Choose a route");
    expect(resolver("")).toBe("Choose a route");
  });

  it("blue-packet → returns the backwards-compatible firstRun resolver", () => {
    const resolver = routeRiskLabelsForDelivery("blue-packet");
    // The default `routeRiskActionLabel` is pinned to the firstRun row
    // for backwards compatibility with the other call site in main.js.
    // A blue-packet delivery must agree byte-for-byte with it so the
    // wire-up only diverges on the red-tag identity.
    expect(resolver("take-the-long-way")).toBe(
      routeRiskActionLabel("take-the-long-way"),
    );
    expect(resolver("take-the-shortcut")).toBe(
      routeRiskActionLabel("take-the-shortcut"),
    );
    expect(resolver("repair-the-loss")).toBe(
      routeRiskActionLabel("repair-the-loss"),
    );
    expect(resolver("carry-a-fragile-packet")).toBe(
      routeRiskActionLabel("carry-a-fragile-packet"),
    );
    // Explicit identity: the resolver IS the default export (same
    // function reference), not just structurally equivalent.
    expect(resolver).toBe(routeRiskActionLabel);
  });

  it("unknown delivery id → falls back to the firstRun resolver (never leaks red-tag labels onto a non-red surface)", () => {
    const resolver = routeRiskLabelsForDelivery("something-new");
    expect(resolver).toBe(routeRiskActionLabel);
    expect(resolver("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel,
    );
    expect(resolver("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.firstRun.riskyRouteLabel,
    );
  });

  it("is a pure function of delivery id — same input yields byte-identical label output", () => {
    const a = routeRiskLabelsForDelivery("red-tag");
    const b = routeRiskLabelsForDelivery("red-tag");
    expect(a("take-the-long-way")).toBe(b("take-the-long-way"));
    expect(a("take-the-shortcut")).toBe(b("take-the-shortcut"));
  });
});
