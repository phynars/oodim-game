/**
 * Projects the currently selected dialogue beat into the served-page DOM.
 *
 * State selection remains in the caller: this module deliberately receives
 * only the selected beat/line and the DOM-writing dependencies it needs.
 *
 * NOTE on `getDialogueLine` (not a plain `dialogueLine` value): `syncIoLine()`
 * is what writes `state.npcs.io.lastLine`. Passing the line as an eagerly-
 * evaluated argument would snapshot it BEFORE `syncIoLine()` runs here, so
 * on the render where the beat changes the DOM would receive the previous
 * line. The getter defers the read until after the sync so the DOM always
 * sees the post-sync line.
 */
export const renderAftersignDialogue = ({
  beat,
  line,
  speaker,
  speakerName,
  getDialogueLine,
  syncIoLine,
  stampBeat,
  setTextContentIfChanged,
}) => {
  syncIoLine();
  stampBeat(line, beat);
  setTextContentIfChanged(speaker, speakerName);
  setTextContentIfChanged(line, getDialogueLine());
};
