import { describe, expect, it } from "vitest";
import {
  offerTrayState,
  renderOfferTray,
  setOfferTrayVisibility,
} from "./offer-tray-render.js";

describe("offer tray renderer", () => {
  const offers = [{ id: "safe" }, { id: "debt" }];

  it("hides outside packet-offered and filters eligibility on the offer beat", () => {
    expect(offerTrayState({ beat: "packet-choice", offers })).toEqual({ visible: false, offers: [] });
    expect(offerTrayState({
      beat: "packet-offered",
      offers,
      isEligible: (offer) => offer.id === "safe",
    })).toEqual({ visible: true, offers: [offers[0]] });
  });

  it("setOfferTrayVisibility only toggles data-visible — never touches children", () => {
    // Mirrors the shipped `#offeredJobs` surface: static label seeded in
    // index.html, must survive every off-beat renderText() tick.
    document.body.innerHTML =
      '<div id="offers" data-visible="false">' +
      '<span class="route-choice-label">Offered jobs</span>' +
      "</div>";
    const container = document.querySelector("#offers");
    const label = container.querySelector(".route-choice-label");

    // Show, then hide — pre-existing child must survive the hide.
    setOfferTrayVisibility(container, true);
    expect(container.dataset.visible).toBe("true");
    expect(container.querySelector(".route-choice-label")).toBe(label);

    setOfferTrayVisibility(container, false);
    expect(container.dataset.visible).toBe("false");
    expect(container.querySelector(".route-choice-label")).toBe(label);
    expect(container.childElementCount).toBe(1);
  });

  it("renderOfferTray preserves static children while clearing its own offer buttons on hide", () => {
    document.body.innerHTML =
      '<div id="offers">' +
      '<span class="route-choice-label">Offered jobs</span>' +
      "</div>";
    const container = document.querySelector("#offers");
    const label = container.querySelector(".route-choice-label");

    // Show tray with two offers.
    renderOfferTray({
      container,
      beat: "packet-offered",
      offers,
      buildOffer: (offer) => {
        const button = document.createElement("button");
        button.id = `job-offer-${offer.id}`;
        return button;
      },
    });
    expect(container.querySelectorAll("button").length).toBe(2);
    expect(container.querySelector(".route-choice-label")).toBe(label);

    // Hide — static label stays, tray-owned buttons go.
    renderOfferTray({
      container,
      beat: "packet-choice",
      offers,
      buildOffer: () => document.createElement("button"),
    });
    expect(container.dataset.visible).toBe("false");
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.querySelector(".route-choice-label")).toBe(label);
    expect(container.childElementCount).toBe(1);
  });

  it("wires selection to the rendered eligible button", () => {
    document.body.innerHTML = '<div id="offers"></div>';
    const selected = [];
    renderOfferTray({
      container: document.querySelector("#offers"),
      beat: "packet-offered",
      offers,
      isEligible: (offer) => offer.id === "safe",
      buildOffer: (offer) => {
        const button = document.createElement("button");
        button.id = `job-offer-${offer.id}`;
        return button;
      },
      onSelect: (offer, node) => selected.push([offer.id, node.id]),
    });
    document.querySelector("#job-offer-safe").click();
    expect(selected).toEqual([["safe", "job-offer-safe"]]);
    expect(document.querySelector("#job-offer-debt")).toBeNull();
  });
});
