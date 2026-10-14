/**
 * Shared runtime boundary for aftersign's interaction surfaces
 * (job offer, packet offer, route choice).
 *
 * Each surface has the same shape at the composition seam: a reader that
 * exposes the current authoritative state, and a handler that forwards a
 * player input into the durable commit path already owned by the runtime.
 * Rendering is NOT part of this contract — the served runtime drives DOM
 * rendering through its own authority (`renderText`), and routing it back
 * through the controller would be dead ceremony. The factory therefore
 * stays minimal: validate the two things that matter, forward them, and
 * freeze the result so consumers can't bolt on hidden state.
 *
 * This is the single factory used for all three surfaces. Giving each
 * surface its own ~20-line copy was the AI002 smell flagged on #2309; one
 * factory invoked three times satisfies the issue's "explicit input/state
 * boundary" requirement without the duplication.
 *
 * @param {object} wiring
 * @param {() => unknown} wiring.getState — reads the authoritative state.
 * @param {(input: unknown) => unknown} wiring.handleInput — forwards the
 *   player's input into the runtime's durable commit path.
 * @param {string} [wiring.label] — surface name used only in thrown
 *   TypeErrors so composition mistakes point at the right surface.
 */
export function createInteractionSurfaceController({
  getState,
  handleInput,
  label = "interactionSurface",
} = {}) {
  if (typeof getState !== "function") {
    throw new TypeError(`createInteractionSurfaceController(${label}) requires getState()`);
  }
  if (typeof handleInput !== "function") {
    throw new TypeError(
      `createInteractionSurfaceController(${label}) requires handleInput(input)`,
    );
  }

  return Object.freeze({
    label,
    getState: () => getState(),
    handleInput: (input) => handleInput(input),
  });
}
