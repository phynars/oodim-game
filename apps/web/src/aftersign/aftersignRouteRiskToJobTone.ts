import type { AftersignJobRiskTone } from "./ioJobOfferActionFeel";

/**
 * Translate the offered-job selector's route-risk vocabulary into the
 * decorative action-feel vocabulary used by the served button surface.
 */
export function aftersignRouteRiskToJobTone(
  routeRisk: unknown,
): AftersignJobRiskTone {
  switch (routeRisk) {
    case "medium":
      return "risky";
    case "high":
      return "consequence";
    case "low":
    default:
      return "safe";
  }
}
