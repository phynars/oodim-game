import { describe, expect, it } from "vitest";
import { chooseAftersignJobOfferCopy } from "./aftersignJobOfferCopy.js";

describe("sealed first-delivery follow-up", () => {
  it("offers the promised red-tag delivery to Saint Orra", () => {
    const offer = chooseAftersignJobOfferCopy({ deliveredSealed: true });

    expect(offer.actionLabel).toMatch(/red[-\s]tag/i);
    expect(offer.ioLine).toMatch(/Saint Orra/i);
    expect(offer.route).toMatch(/red tag/i);
    expect(offer.route).toMatch(/Saint Orra/i);
  });
});
