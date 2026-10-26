import { describe, expect, it } from "vitest";
import {
  aftersignPacketRecallLine,
  aftersignPacketRecallToken,
} from "./aftersignPacketRecallCopy.js";

describe("legacy fast-route packet recall", () => {
  it("keeps an actionless fast record migration-only rather than rendering it to a player", () => {
    const token = aftersignPacketRecallToken({
      lastRoute: "fast",
      succeeded: true,
    });

    expect(token).toBeNull();
    expect(aftersignPacketRecallLine(token)).toBe("");
  });

  it("retains the recognized shortcut recall", () => {
    expect(
      aftersignPacketRecallToken({
        lastRoute: "fast",
        succeeded: true,
        lastAction: "take-the-shortcut",
      }),
    ).toBe("fast");
  });

  it("retains the recognized fragile recall", () => {
    expect(
      aftersignPacketRecallToken({
        lastRoute: "fast",
        succeeded: false,
        lastAction: "carry-a-fragile-packet",
      }),
    ).toBe("fragile");
  });
});
