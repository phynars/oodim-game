// AFTERSIGN presentation boundary: attaches the visible mobile movement pad.
// It forwards normalized input to the runtime without owning game state.

import { attachMobileMovePad } from "../mobileMovePad.ts";

/**
 * Create the mobile movement input controller.
 * @param {{ root: HTMLElement | null, knob: HTMLElement | null, onInput: (x: number, z: number, source?: string) => void, feel: object }} dependencies
 */
export function createMobileInputController({ root, knob, onInput, feel }) {
  const controller = attachMobileMovePad({
    root,
    knob,
    onInput,
    feel,
  });

  // Preserve the adapter's complete controller surface while making this
  // presentation module the owner of its DOM attachment boundary.
  return controller;
}
