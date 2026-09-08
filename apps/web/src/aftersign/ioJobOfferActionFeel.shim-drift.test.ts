import { describe, expect, it } from "vitest";

import {
  AFTERSIGN_JOB_OFFER_ACTION_FEEL,
  AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
} from "./ioJobOfferActionFeel";

type AftersignJobOfferActionFeelShim = {
  AFTERSIGN_JOB_OFFER_ACTION_FEEL: typeof AFTERSIGN_JOB_OFFER_ACTION_FEEL;
  AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS: typeof AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS;
};

describe("aftersignJobOfferActionFeelShim drift guard", () => {
  it("matches the TypeScript feel table and pressed-class vocabulary", async () => {
    const shim = (await import(
      "../../../../aftersign/src/aftersignJobOfferActionFeelShim.js"
    )) as AftersignJobOfferActionFeelShim;

    expect(shim.AFTERSIGN_JOB_OFFER_ACTION_FEEL).toEqual(
      AFTERSIGN_JOB_OFFER_ACTION_FEEL,
    );
    expect(shim.AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS).toBe(
      AFTERSIGN_JOB_OFFER_ACTION_PRESSED_CLASS,
    );
  });
});
