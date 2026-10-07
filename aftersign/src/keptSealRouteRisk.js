// First visit has no delivery history to repair. "repair-the-loss" is a
// recovery action for a RECORDED failed run — it has no referent when
// `state.player.routeRisk` is still null (nothing has happened on record).
//
// We can't model this by synthesising a "safe + succeeded" memory and feeding
// it into `computeOfferedActions`: that function's successful-safe branch
// returns `["take-the-shortcut","carry-a-fragile-packet"]`, which omits
// `take-the-long-way` — the long-way route IS still a legitimate first-visit
// choice (see `aftersign/e2e/aftersign-packet-recall-feel.playtest.spec.ts`,
// which taps `take-the-long-way` on a fresh slot to prove the memory round-
// trip). So we keep the null-memory offer set (`repair-the-loss` +
// `take-the-long-way`) and only HIDE the recovery entry when `routeRisk` is
// null — i.e. no prior run has been recorded at all.
//
// Why key off `routeRisk == null` only (no `packet` argument at all):
//   Gating the hide on `packet.sealed === true` would add a runtime premise
//   ("the `#packetButton` tap sets sealed BEFORE packet-choice renders")
//   that this module cannot verify in isolation. The pure semantic —
//   "no memory on record → nothing to repair" — covers the kept-seal
//   first-visit case AND the opened-first-visit case AND the fresh-slot-
//   no-tap case, without depending on `main.js` ordering. The signature
//   deliberately takes no `packet` argument so a future contributor can't
//   accidentally reintroduce the premise by reading `packet.sealed` here.
//   Soren's PR #2206 review flagged the prior `packet` param as unread —
//   dropping it from the signature nails that invariant into the contract.
//
// When `routeRisk` IS set, respect `computeOfferedActions`'s existing logic
// in full: a recorded failure (`succeeded === false`) legitimately offers
// `repair-the-loss`, and a success returns a set that doesn't contain it.
//
// Return shape: the memory to feed `renderRouteRiskChoice` plus the list of
// actions the renderer should drop from the offered set.
export const routeRiskMemoryForPacketChoice = (routeRisk) => {
  if (routeRisk == null) {
    return { memory: null, hideActions: ["repair-the-loss"] };
  }
  return { memory: routeRisk, hideActions: [] };
};
