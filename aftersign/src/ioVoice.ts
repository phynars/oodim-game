// Io's voice, spoken through DOM surfaces.
//
// The player never hears Io — she speaks through text nodes on the
// served AFTERSIGN page. Each constant in this module is the SINGLE
// SOURCE OF TRUTH for one line she says, kept out of `index.html` so
// a wardrobe pass reads like dialogue (this file) rather than markup.
//
// Wire-in contract: every line here is either (a) already rendered
// verbatim into the served DOM at boot (grep the string in
// `aftersign/index.html`) or (b) written into a DOM node at runtime
// by `aftersign/main.js`. A line with no consumer is an orphan and
// reds the served-surface contract test in
// `apps/web/src/aftersign/servedSurface.contract.test.ts`.

/**
 * Spoken when the player releases the packet aim before the reticle
 * has locked a target — the "you almost lost it" reassurance.
 *
 * Rendered surface: `#targetLossPrompt` in `aftersign/index.html`
 * (a `[aria-live="polite"]` paragraph beneath the aim reticle). The
 * paragraph carries this text at boot and stays live for the full
 * target-loss envelope authored in `aftersign/src/targetLossFeedback.ts`
 * (100ms — plateau at opacity 1 for 24ms, then linear fade to 0).
 *
 * Played-not-driven assertion: `aftersign/e2e/target-loss-feedback.spec.ts`
 * presses `#packetButton` and releases; the release edge stamps
 * `data-target-loss-active="true"` on `#aimReticle` and the prompt
 * fades from full opacity. That spec now also asserts the prompt's
 * `textContent` equals this constant so a rename here (or a
 * placeholder resurfacing in the HTML) reds the played surface.
 *
 * Contract pin: `servedSurface.contract.test.ts` reads THIS file's
 * source AND the shipped `aftersign/index.html`, and requires the
 * exact string to appear inside `#targetLossPrompt`. If a future
 * refactor renames the constant or edits the served copy in place,
 * the two drift → the test reds before any player sees the
 * mismatch.
 */
export const IO_TARGET_LOSS_LINE =
  "Keep your hands steady. The packet is still there.";
