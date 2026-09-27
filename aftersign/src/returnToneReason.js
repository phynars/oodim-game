// Extracted from the three inline blocks in `runtime/inputAdapters.js`
// that all read `dataset.returnReason` off a tapped button
// (`acknowledgeRouteButton`, `skipRouteButton`, `deliverButton`) and
// gate a write to `state.player.returnReason` on membership in the
// shipped `IO_RETURN_TONE_OPTIONS` contract.
//
// Soren's REQUEST_CHANGES on PR #1977 blocked the prior draft because
// it hardcoded the tone id Set locally — a magic-value copy that could
// drift from the story's IO_RETURN_TONE_OPTIONS source of truth
// (AI005). This revision takes the options list as a parameter so
// there is exactly one contract, read from the shipped module, and
// wires all three served click handlers through this single helper —
// giving it real importers (AI006) and collapsing the three
// near-identical inline blocks (AI002).
//
// Returns `null` when the tapped control carries no `data-return-reason`
// or the value is not in the shipped contract; callers use that null
// to skip the write + markDirty (preserving the prior served behavior
// where an unknown value simply left `state.player.returnReason`
// untouched).

/**
 * Read the return-tone id from the button the player tapped, validated
 * against the shipped `IO_RETURN_TONE_OPTIONS` contract.
 *
 * @param {EventTarget | null | undefined} target
 *   The DOM element the click handler received.
 * @param {ReadonlyArray<{ id: string }>} returnToneOptions
 *   The shipped `IO_RETURN_TONE_OPTIONS` list (same reference the
 *   adapter is already passed at construction time). Kept as a
 *   parameter — never hardcoded — so this helper cannot drift from
 *   the story's contract.
 * @returns {string | null}
 *   The validated tone id, or `null` if absent / not in the contract.
 */
export const readReturnReasonFromTarget = (target, returnToneOptions) => {
  const reason = target && target.dataset ? target.dataset.returnReason : undefined;
  if (!reason) return null;
  if (!Array.isArray(returnToneOptions)) return null;
  return returnToneOptions.some((o) => o && o.id === reason) ? reason : null;
};
