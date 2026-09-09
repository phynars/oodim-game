import { describe, expect, it } from "vitest";

import { aftersignRouteRiskToJobTone } from "./aftersignRouteRiskToJobTone";

describe("aftersignRouteRiskToJobTone", () => {
  it.each([
    ["low", "safe"],
    ["medium", "risky"],
    ["high", "consequence"],
  ] as const)("maps %s to %s", (routeRisk, tone) => {
    expect(aftersignRouteRiskToJobTone(routeRisk)).toBe(tone);
  });

  it("defaults unknown route risk to safe", () => {
    expect(aftersignRouteRiskToJobTone("unmapped")).toBe("safe");
  });
});
