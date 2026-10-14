/**
 * Runtime boundary for the packet-offer interaction surface.
 *
 * Composition supplies the state reader, renderer, and durable gesture
 * handler; this module keeps their contract explicit without changing the
 * packet intent or persistence semantics.
 */
export function createPacketOfferController({ getState, render, handleInput }) {
  if (typeof getState !== "function") {
    throw new TypeError("createPacketOfferController requires getState()");
  }
  if (typeof render !== "function") {
    throw new TypeError("createPacketOfferController requires render(state)");
  }
  if (typeof handleInput !== "function") {
    throw new TypeError("createPacketOfferController requires handleInput(input)");
  }

  return Object.freeze({
    getState: () => getState(),
    render: () => render(getState()),
    handleInput: (input) => handleInput(input),
  });
}
