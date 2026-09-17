/**
 * Product guard for future AFTERSIGN surfaces: player-facing offers must be
 * rendered before their copy is considered shippable.
 */
export function hasRenderedOfferSurface(element) {
  return element instanceof HTMLElement && element.isConnected;
}
