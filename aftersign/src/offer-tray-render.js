// Offer-tray rendering boundary. The caller owns story state and effects;
// this module owns only DOM projection and dispatches a selected offer back
// through an explicit callback.
//
// Child-ownership rule: `setOfferTrayVisibility` ONLY toggles the
// `data-visible` attribute — identical to the pre-extraction main.js
// behavior. It MUST NOT clear children, because the shipped surface
// seeds a static `<span class="route-choice-label">Offered jobs</span>`
// inside `#offeredJobs` (see `aftersign/index.html`), and that label is
// written once at page load, not on every renderText() tick. Wiping it on
// an off-beat render would silently delete the label.
//
// Children that the TRAY itself mounts (the offer buttons) are owned and
// cleared by `renderOfferTray` only, which operates on data nodes it
// created — never on nodes it did not.

const OFFER_NODE_FLAG = "aftersignOfferTrayNode";

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

const clearTrayOwnedChildren = (container) => {
  if (!container) return;
  // Only remove nodes the tray itself mounted; preserve statically-authored
  // children like the `<span class="route-choice-label">` seed from index.html.
  const owned = [];
  for (const child of container.childNodes) {
    if (child.nodeType === 1 && child.dataset && child.dataset[OFFER_NODE_FLAG] === "true") {
      owned.push(child);
    }
  }
  for (const node of owned) container.removeChild(node);
};

/**
 * Build an offer tray from explicit data. `buildOffer` may decorate the button
 * before it is mounted; `onSelect` receives the exact offer and tapped node.
 *
 * The tray owns only the nodes it mounts: each is tagged with
 * `data-aftersign-offer-tray-node="true"`, and both hide and re-render paths
 * remove only tagged nodes. Static children authored in `index.html` survive.
 */
export const renderOfferTray = ({ container, beat, offers, isEligible, buildOffer, onSelect }) => {
  const tray = offerTrayState({ beat, offers, isEligible });
  setOfferTrayVisibility(container, tray.visible);
  if (!container) return tray;

  // Always clear previously-mounted offer buttons before (re)rendering —
  // whether we're hiding or showing. Static children are left intact.
  clearTrayOwnedChildren(container);

  if (!tray.visible || typeof buildOffer !== "function") return tray;

  for (const offer of tray.offers) {
    const node = buildOffer(offer);
    if (!node) continue;
    if (node.dataset) node.dataset[OFFER_NODE_FLAG] = "true";
    node.addEventListener("click", () => onSelect?.(offer, node));
    container.appendChild(node);
  }
  return tray;
};
