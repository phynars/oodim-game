import { buildRouteRiskRenderSignature } from "./routeRiskRenderSignature.js";

const assertEqual = (actual: string, expected: string, label: string): void => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
};

export const runRouteRiskRenderSignatureChecks = (): void => {
  assertEqual(buildRouteRiskRenderSignature(null), "fresh", "fresh tray");
  assertEqual(
    buildRouteRiskRenderSignature({ lastRoute: "fast", succeeded: true }),
    "fast:succeeded",
    "fast successful route",
  );
  assertEqual(
    buildRouteRiskRenderSignature({ lastRoute: "safe", succeeded: false }),
    "safe:failed",
    "failed route",
  );
};

runRouteRiskRenderSignatureChecks();
