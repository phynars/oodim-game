/**
 * Runtime boundary for the route-choice interaction surface.
 *
 * The factory is pure composition: input commits, state reads, and DOM
 * rendering remain supplied by the runtime that already owns them.
 */
export function createRouteChoiceController({ getState, render, handleInput }) {
  if (typeof getState !== "function") {
    throw new TypeError("createRouteChoiceController requires getState()");
  }
  if (typeof render !== "function") {
    throw new TypeError("createRouteChoiceController requires render(state)");
  }
  if (typeof handleInput !== "function") {
    throw new TypeError("createRouteChoiceController requires handleInput(input)");
  }

  return Object.freeze({
    getState: () => getState(),
    render: () => render(getState()),
    handleInput: (input) => handleInput(input),
  });
}
