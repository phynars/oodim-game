/**
 * Runtime boundary for the dynamically rendered job-offer surface.
 *
 * The controller deliberately receives every side effect from composition:
 * it owns no global state and does not bind to a particular document. This
 * makes the surface renderable both by the served runtime and by a test DOM.
 */
export function createJobOfferController({ getState, render, handleInput }) {
  if (typeof getState !== "function") {
    throw new TypeError("createJobOfferController requires getState()");
  }
  if (typeof render !== "function") {
    throw new TypeError("createJobOfferController requires render(state)");
  }
  if (typeof handleInput !== "function") {
    throw new TypeError("createJobOfferController requires handleInput(input)");
  }

  return Object.freeze({
    getState: () => getState(),
    render: () => render(getState()),
    handleInput: (input) => handleInput(input),
  });
}
