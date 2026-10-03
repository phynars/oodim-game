import { describe, expect, it } from "vitest";
import { offerTrayState, renderOfferTray } from "./offer-tray-render.js";

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
