// A sealed packet with no delivery history starts a clean route. Route-risk
// recovery actions ("repair-the-loss") belong only to a recorded FAILED run,
// never to the first decision after keeping the seal.
//
// We can't model this by synthesising a "safe + succeeded" memory and feeding
// it into `computeOfferedActions`: that function's successful-safe branch
// returns `["take-the-shortcut","carry-a-fragile-packet"]`, which omits
// `take-the-long-way` — the long-way route IS still a legitimate first-visit
// choice (see `aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts`,
// which taps `take-the-long-way` on a fresh slot to prove the memory round-
// trip). So we keep the null-memory offer set (`repair-the-loss` +
// `take-the-long-way`) and only HIDE the recovery entry when the seal is
// kept and there's no prior run on record.
//
// Return shape: the memory to feed `renderRouteRiskChoice` plus an optional
// list of actions the renderer should drop from the offered set.
export const routeRiskMemoryForPacketChoice = (packet, routeRisk) => {
  if (routeRisk == null && packet?.sealed) {
    return { memory: null, hideActions: ["repair-the-loss"] };
  }
  return { memory: routeRisk ?? null, hideActions: [] };
};
