// Offer-tray rendering boundary. The caller owns story state and effects;
// this module owns only DOM projection and dispatches a selected offer back
// through an explicit callback.

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
  if (!visible && container.firstChild) {
    while (container.firstChild) container.removeChild(container.firstChild);
  }
  return Boolean(visible);
};

/**
 * Build an offer tray from explicit data. `buildOffer` may decorate the button
 * before it is mounted; `onSelect` receives the exact offer and tapped node.
 */
export const renderOfferTray = ({ container, beat, offers, isEligible, buildOffer, onSelect }) => {
  const tray = offerTrayState({ beat, offers, isEligible });
  if (!setOfferTrayVisibility(container, tray.visible)) return tray;
  if (!container || typeof buildOffer !== "function") return tray;

  while (container.firstChild) container.removeChild(container.firstChild);
  for (const offer of tray.offers) {
    const node = buildOffer(offer);
    if (!node) continue;
    node.addEventListener("click", () => onSelect?.(offer, node));
    container.appendChild(node);
  }
  return tray;
};
