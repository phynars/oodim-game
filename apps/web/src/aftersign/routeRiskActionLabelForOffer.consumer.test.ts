// Consumer test for `routeRiskActionLabelForOffer` — the memory-aware
// resolver added for #2241 (round-2 red-tag second-packet needs the
// route-choice buttons to speak the TRUSTED offer-copy row's labels,
// not the firstRun blue-packet defaults).
//
// Why this test exists (Soren's AI007 on PR #2244 iter-1):
//   The prior iteration shipped only a comment edit on
//   `aftersignJobAcceptedCopy.js` — no code, no test, no evidence the
//   fix lands anywhere a player sees. This test fails on base
//   (`routeRiskActionLabelForOffer` is not exported from the module on
//   `main`) and passes once the export + implementation lands. That's
//   the fail-on-base signal the bug-PR lane requires.
//
// Scope — what this test pins:
//   1. Divergence: a resolver bound to the TRUSTED row returns the
//      red-tag labels ("Long way — past the kiosk" / "Behind the
//      shuttered pharmacy"), not the firstRun blue-packet defaults
//      ("Lit stair — under Io's window" / "Cut past the bell rope").
//      This is the acceptance criterion from #2241 for the
//      route-choice surface, held at the pure-resolver layer so the
//      wire-up in `aftersign/main.js` has a byte-identical ground
//      truth to pass through.
//   2. Source-of-truth invariant: the labels come VERBATIM from
//      `AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel` /
//      `.riskyRouteLabel` — no new vocabulary, no hardcoded literal
//      in the resolver (#2241 acceptance: "All strings sourced from
//      frozen copy modules").
//   3. Backwards compatibility: the default `routeRiskActionLabel`
//      export still returns the firstRun labels so the two existing
//      `renderRouteRiskChoice({ labelForAction: routeRiskActionLabel })`
//      call sites in `aftersign/main.js` keep working unchanged until
//      a follow-up PR wires the memory-aware factory into the round-2
//      call site.
//   4. Resilience: a nullish / malformed `offerCopy` falls back to the
//      firstRun row — never ships raw action ids to the DOM.

import { describe, expect, it } from "vitest";

import { AFTERSIGN_JOB_OFFER_COPY } from "./aftersignJobOfferCopy.js";
import {
  routeRiskActionLabel,
  routeRiskActionLabelForOffer,
} from "./routeRiskActionLabels.js";

describe("routeRiskActionLabelForOffer", () => {
  it("binds to the TRUSTED row and returns the red-tag route labels (#2241)", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.trusted,
    );
    expect(resolver("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.safeRouteLabel,
    );
    expect(resolver("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.trusted.riskyRouteLabel,
    );
    // Explicit literal pins — if the authored copy drifts, this
    // test speaks the player-visible symptom (#2241's "red tag /
    // Saint Orra / pharmacy sign never appear" report).
    expect(resolver("take-the-long-way")).toBe("Long way — past the kiosk");
    expect(resolver("take-the-shortcut")).toBe(
      "Behind the shuttered pharmacy",
    );
  });

  it("does NOT return the firstRun blue-packet labels when bound to the trusted row (#2241 symptom)", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.trusted,
    );
    // #2241 report: "Round-2 route-choice buttons still show
    //   'Cut past the bell rope / Carry the fragile packet / Lit stair'".
    // The resolver bound to TRUSTED must NOT emit either of the
    // firstRun route literals.
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

  it("binds to the OPENED row and returns the wax-debt route labels", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.opened,
    );
    expect(resolver("take-the-long-way")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.opened.safeRouteLabel,
    );
    expect(resolver("take-the-shortcut")).toBe(
      AFTERSIGN_JOB_OFFER_COPY.opened.riskyRouteLabel,
    );
  });

  it("binds to the firstRun row and matches the backwards-compatible default export", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.firstRun,
    );
    // The default `routeRiskActionLabel` export is pinned to firstRun
    // for backwards compatibility with the two existing main.js
    // call sites; a resolver explicitly bound to firstRun must agree
    // with that default byte-for-byte, so a wire-up that swaps the
    // default for the factory on the first-run beat produces IDENTICAL
    // player-visible labels.
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
  });

  it("preserves the non-route action labels across every memory branch", () => {
    // `repair-the-loss` and `carry-a-fragile-packet` are not
    // memory-branched (they describe recovery / fragility, not a
    // route Io named), so every bound resolver returns the same
    // literal.
    const branches = [
      AFTERSIGN_JOB_OFFER_COPY.firstRun,
      AFTERSIGN_JOB_OFFER_COPY.trusted,
      AFTERSIGN_JOB_OFFER_COPY.opened,
    ];
    for (const row of branches) {
      const resolver = routeRiskActionLabelForOffer(row);
      expect(resolver("repair-the-loss")).toBe(
        "Repair the loss before you run",
      );
      expect(resolver("carry-a-fragile-packet")).toBe(
        "Carry the fragile packet",
      );
    }
  });

  it("falls back to the firstRun row when offerCopy is null / undefined / malformed", () => {
    const fallbackCases: Array<unknown> = [
      null,
      undefined,
      {},
      { safeRouteLabel: 42, riskyRouteLabel: "x" },
      { safeRouteLabel: "x" }, // missing riskyRouteLabel
      "not an object",
      0,
    ];
    for (const bad of fallbackCases) {
      const resolver = routeRiskActionLabelForOffer(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bad as any,
      );
      expect(resolver("take-the-long-way")).toBe(
        AFTERSIGN_JOB_OFFER_COPY.firstRun.safeRouteLabel,
      );
      expect(resolver("take-the-shortcut")).toBe(
        AFTERSIGN_JOB_OFFER_COPY.firstRun.riskyRouteLabel,
      );
    }
  });

  it("returns a generic prompt for unknown action ids (no raw id leaks to the DOM)", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.trusted,
    );
    expect(resolver("some-future-action-id")).toBe("Choose a route");
    expect(resolver("")).toBe("Choose a route");
  });

  it("returns a stable (byte-identical) label on repeated calls — no per-call allocation drift", () => {
    const resolver = routeRiskActionLabelForOffer(
      AFTERSIGN_JOB_OFFER_COPY.trusted,
    );
    const a = resolver("take-the-long-way");
    const b = resolver("take-the-long-way");
    expect(a).toBe(b);
  });
});
