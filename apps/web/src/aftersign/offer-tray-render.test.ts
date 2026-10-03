// Vitest spec for the offer-tray boundary extracted from
// `aftersign/main.js` into `aftersign/src/offer-tray-render.js`
// (PR #2129 / #2125).
//
// This file lives under `apps/web/src/aftersign/` so it is picked up by
// the `apps/web/src/aftersign/**/*.test.ts` glob in
// `apps/web/src/aftersign/vitest.config.ts` and runs under the
// `test:unit:aftersign` lane in CI. The sibling `aftersign/README.md`
// forbids vitest suites under `aftersign/` itself (that tree is
// plain-TS assertion harnesses only), so the module stays at
// `aftersign/src/` and its vitest coverage lives here.
//
// Scope: exercises only the two exports main.js consumes —
// `offerTrayState` (pure beat → visibility + eligibility filter) and
// `setOfferTrayVisibility` (the DOM attribute toggle that MUST NOT
// clear statically-authored children of `#offeredJobs`).

import { describe, expect, it } from "vitest";
import {
  offerTrayState,
  setOfferTrayVisibility,
  // @ts-expect-error — the module is authored as plain JS alongside
  // main.js; the vitest lane resolves it through node module
  // resolution (jsdom env, no .ts shim needed).
} from "../../../../aftersign/src/offer-tray-render.js";

describe("offer tray boundary", () => {
  const offers = [{ id: "safe" }, { id: "debt" }];

  it("hides outside packet-offered and returns no offers off-beat", () => {
    expect(offerTrayState({ beat: "packet-choice", offers })).toEqual({
      visible: false,
      offers: [],
    });
    expect(offerTrayState({ beat: "arrival", offers })).toEqual({
      visible: false,
      offers: [],
    });
  });

  it("surfaces every offer on the packet-offered beat by default", () => {
    expect(offerTrayState({ beat: "packet-offered", offers })).toEqual({
      visible: true,
      offers,
    });
  });

  it("applies the eligibility filter on the offer beat", () => {
    expect(
      offerTrayState({
        beat: "packet-offered",
        offers,
        isEligible: (offer: { id: string }) => offer.id === "safe",
      }),
    ).toEqual({ visible: true, offers: [offers[0]] });
  });

  it("tolerates a missing offers array without throwing", () => {
    // Mirrors the current main.js call site, which passes `offers: []`
    // while the data wiring is extracted incrementally.
    expect(
      offerTrayState({ beat: "packet-offered", offers: undefined as never }),
    ).toEqual({ visible: true, offers: [] });
  });

  it("setOfferTrayVisibility only toggles data-visible — never touches children", () => {
    // Mirrors the shipped `#offeredJobs` surface: a static label is
    // seeded in `aftersign/index.html` and must survive every off-beat
    // `renderText()` tick. Pre-extraction main.js only toggled
    // `data-visible`; the extraction must preserve that invariant.
    document.body.innerHTML =
      '<div id="offers" data-visible="false">' +
      '<span class="route-choice-label">Offered jobs</span>' +
      "</div>";
    const container = document.querySelector("#offers") as HTMLElement;
    const label = container.querySelector(".route-choice-label");

    setOfferTrayVisibility(container, true);
    expect(container.dataset.visible).toBe("true");
    expect(container.querySelector(".route-choice-label")).toBe(label);
    expect(container.childElementCount).toBe(1);

    setOfferTrayVisibility(container, false);
    expect(container.dataset.visible).toBe("false");
    expect(container.querySelector(".route-choice-label")).toBe(label);
    expect(container.childElementCount).toBe(1);
  });

  it("setOfferTrayVisibility is a no-op on a null container", () => {
    expect(setOfferTrayVisibility(null as unknown as HTMLElement, true)).toBe(false);
    expect(setOfferTrayVisibility(undefined as unknown as HTMLElement, false)).toBe(false);
  });

  it("coerces truthy/falsy values to the canonical string the DOM reads", () => {
    document.body.innerHTML = '<div id="offers"></div>';
    const container = document.querySelector("#offers") as HTMLElement;

    setOfferTrayVisibility(container, 1 as unknown as boolean);
    expect(container.dataset.visible).toBe("true");

    setOfferTrayVisibility(container, 0 as unknown as boolean);
    expect(container.dataset.visible).toBe("false");
  });
});
