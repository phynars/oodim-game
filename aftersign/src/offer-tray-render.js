// Offer-tray rendering boundary. The caller owns story state and effects;
// this module currently owns only the beat → visibility projection + the
// DOM attribute toggle that main.js previously open-coded on every
// `renderText()` tick.
//
// Scope note (Soren's REQUEST_CHANGES on PR #2129): earlier drafts also
// exported `renderOfferTray` + `clearTrayOwnedChildren` to drive the
// offer-button mount. Those exports had no served consumer — `main.js`
// still builds its own `<button id="job-offer-<jobId>">` nodes inline
// (so the per-offer AFTERSIGN_JOB_TAKE_FEEL stamp, intent-feedback,
// job-ack line, and route-risk callback stay wired without a seam
// change), so the extra surface was dead on the served path. Keep this
// module scoped to the two helpers `main.js` actually imports; a later
// PR can land the mount seam when it has a shipped caller.
//
// Child-ownership rule: `setOfferTrayVisibility` ONLY toggles the
// `data-visible` attribute — identical to the pre-extraction main.js
// behavior. It MUST NOT clear children, because the shipped surface
// seeds a static `<span class="route-choice-label">Offered jobs</span>`
// inside `#offeredJobs` (see `aftersign/index.html`), and that label is
// written once at page load, not on every renderText() tick. Wiping it
// on an off-beat render would silently delete the label.

export const offerTrayState = ({ beat, offers, isEligible = () => true }) => {
  const visible = beat === "packet-offered";
  const eligibleOffers = visible && Array.isArray(offers)
    ? offers.filter((offer) => isEligible(offer))
    : [];
  return { visible, offers: eligibleOffers };
};

export const setOfferTrayVisibility = (container, visible) => {
  if (!container) return false;
  const next = String(Boolean(visible));
  if (container.dataset.visible !== next) container.dataset.visible = next;
  return Boolean(visible);
};
