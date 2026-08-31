import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_JOB_OFFER_COPY,
  chooseAftersignJobOfferCopy,
} from "./aftersignJobOfferCopy.js";

const EXPECTED_JOB_OFFER_ACTIONS = {
  firstRun: {
    tappableActionId: "take-job-blue-seal-safe",
    route: "Take the lit stair. Do not stop under the bell rope.",
    risk: "Low risk. Long route. Io can see most of it from the kiosk.",
  },
  trusted: {
    tappableActionId: "take-job-orra-name-risk",
    route: "Cross behind the shuttered pharmacy before the bells count twice.",
    risk: "Short route. Unlit. Better pay because Io trusts your hands.",
  },
  opened: {
    tappableActionId: "take-job-wax-debt-repair",
    route: "Stay in the amber lamps. Let every sign watch the packet.",
    risk: "Low route risk. Low trust. Io keeps the job visible.",
  },
} as const;

describe("Aftersign job-offer divergence contract", () => {
  it("pins each memory branch to a distinct tappable action, route, and risk", () => {
    const branchCopies = {
      firstRun: chooseAftersignJobOfferCopy({ outcome: "fresh" }),
      trusted: chooseAftersignJobOfferCopy({ outcome: "sealed" }),
      opened: chooseAftersignJobOfferCopy({ outcome: "opened" }),
    };

    expect(branchCopies).toEqual(
      expect.objectContaining(EXPECTED_JOB_OFFER_ACTIONS),
    );
    expect(
      new Set(
        Object.values(branchCopies).map((copy) => copy.tappableActionId),
      ),
    ).toHaveLength(3);
  });

  it("keeps every frozen copy row executable from the player input namespace", () => {
    expect(
      AFTERSIGN_JOB_OFFER_COPY.map((copy) => copy.tappableActionId),
    ).toEqual([
      "take-job-blue-seal-safe",
      "take-job-orra-name-risk",
      "take-job-wax-debt-repair",
    ]);
  });
});
