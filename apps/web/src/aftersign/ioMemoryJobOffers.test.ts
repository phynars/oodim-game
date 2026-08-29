import { describe, expect, it } from "vitest";
import { chooseIoJobOffers } from "./ioMemoryJobOffers";

describe("chooseIoJobOffers", () => {
  it("offers a first-time player one safe tappable job", () => {
    const offers = chooseIoJobOffers({});

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      id: "blue-seal-safe-run",
      tappableActionId: "take-job-blue-seal-safe-run",
    });
  });

  it("turns a trusted delivered-seal memory into a different available action", () => {
    const offers = chooseIoJobOffers({
      completedDeliveryIds: ["blue-seal-safe-run"],
      packetOutcome: "delivered",
      trustPosture: "trusted",
    });

    expect(offers.map((offer) => offer.tappableActionId)).toContain(
      "take-job-orra-name-dark-cut",
    );
  });

  it("turns an opened-seal memory into a watched long-stair action", () => {
    const offers = chooseIoJobOffers({
      completedDeliveryIds: ["blue-seal-safe-run"],
      packetOutcome: "opened",
      trustPosture: "watched",
    });

    expect(offers.map((offer) => offer.tappableActionId)).toEqual([
      "take-job-opened-seal-ledger-run",
    ]);
  });

  it("proves M-LOOP divergence at the action id level, not only dialogue", () => {
    const trusted = chooseIoJobOffers({
      completedDeliveryIds: ["blue-seal-safe-run"],
      packetOutcome: "delivered",
      trustPosture: "trusted",
    });
    const watched = chooseIoJobOffers({
      completedDeliveryIds: ["blue-seal-safe-run"],
      packetOutcome: "opened",
      trustPosture: "watched",
    });

    expect(trusted[0]?.tappableActionId).toBe("take-job-orra-name-dark-cut");
    expect(watched[0]?.tappableActionId).toBe("take-job-opened-seal-ledger-run");
    expect(trusted[0]?.tappableActionId).not.toBe(watched[0]?.tappableActionId);
  });
});
