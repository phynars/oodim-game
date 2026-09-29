// AFTERSIGN tactile-feedback ownership boundary.
//
// Keep this list intentionally small and semantic: a touchpoint belongs here
// only when its rendered, player-facing handler owns a distinct acknowledgement
// cue. New feel work should extend an existing owner or demonstrate a
// player-breaking missing interaction before adding another runtime writer.
export const AFTERSIGN_TACTILE_LANE_OWNERS = Object.freeze({
  packet: "packet-press-feedback",
  routeRisk: "route-risk-confirm-feedback",
  returnAction: "io-return-action-feedback",
  jobOffer: "job-offer-press-feedback",
});

export const ownsAftersignTactileLane = (owner) =>
  Object.values(AFTERSIGN_TACTILE_LANE_OWNERS).includes(owner);
