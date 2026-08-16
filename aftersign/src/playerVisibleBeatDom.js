// AFTERSIGN served-page DOM bridge for player-visible story progress.
//
// Purpose: keep milestone evidence anchored to what a phone player can see
// and tap, not to window.__game input hooks. main.js owns the actual render
// loop; this small helper gives that loop one canonical way to stamp the
// current beat and visible choices onto DOM nodes so a phone-facing tap
// harness can locate them via `[data-beat-id]` / `[data-choice-id]`
// selectors instead of reaching into the input surface.
//
// Playwright tap coverage for these attributes lives in
// `aftersign/e2e/phone-tap-visible-choice.spec.ts`, while the served DOM
// attribute contract remains pinned in
// `apps/web/src/aftersign/servedSurface.contract.test.ts`.

export const AFTERSIGN_BEAT_ATTRIBUTE = "data-beat-id";
export const AFTERSIGN_CHOICE_ATTRIBUTE = "data-choice-id";

export const stampAftersignBeat = (node, beatId) => {
  if (!node || typeof beatId !== "string" || beatId.length === 0) {
    return false;
  }

  if (node.getAttribute(AFTERSIGN_BEAT_ATTRIBUTE) !== beatId) {
    node.setAttribute(AFTERSIGN_BEAT_ATTRIBUTE, beatId);
    return true;
  }

  return false;
};

export const stampAftersignChoice = (node, choiceId, { disabled = false } = {}) => {
  if (!node || typeof choiceId !== "string" || choiceId.length === 0) {
    return false;
  }

  let changed = false;

  if (node.getAttribute(AFTERSIGN_CHOICE_ATTRIBUTE) !== choiceId) {
    node.setAttribute(AFTERSIGN_CHOICE_ATTRIBUTE, choiceId);
    changed = true;
  }

  if (node.disabled !== Boolean(disabled)) {
    node.disabled = Boolean(disabled);
    changed = true;
  }

  return changed;
};
