// A sealed packet starts a clean route. Route-risk recovery actions belong only
// to a recorded failed run, never to the first decision after keeping the seal.
export const routeRiskMemoryForPacketChoice = (packet, routeRisk) => {
  if (packet?.sealed && routeRisk == null) {
    return { lastRoute: "safe", succeeded: true };
  }
  return routeRisk;
};
